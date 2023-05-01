import ModbusRTU from 'modbus-serial';
import BaseDevice from './base-device';
interface WriteModbusCoils {
    values: boolean[];
    startingAddress: number;
}

interface WriteModbusRegisters {
    values: number[];
    startingAddress: number;
}

export class HeruAPI {
    device?: BaseDevice;
    client: ModbusRTU;

    isConnected = false;
    reconnectCounter = 0;
    POLLING_INTERVAL = 2000;
    timer: NodeJS.Timeout | null = null;
    ignoreNextRead = false; // Used to prevent reading modbus straight after a command to avoid timing issues
    write = false;
    writeQueue = {
        coils: [],
        holdingRegisters: []
    } as { coils: WriteModbusCoils[]; holdingRegisters: WriteModbusRegisters[] }; //new Map<'coils' | 'holdingRegisters', WriteModbusRegisters[] | WriteModbusCoils[]>();

    registers: ModbusRegisters = {
        coils: {
            start: 0,
            count: 0
        },
        discreteInputs: {
            start: 0,
            count: 0
        },
        inputRegisters: {
            start: 0,
            count: 0
        },
        holdingRegisters: {
            start: 0,
            count: 0
        }
    };

    constructor(device: BaseDevice, registers: ModbusRegisters) {
        this.device = device;
        this.registers = registers;
        this.client = new ModbusRTU();
        // this.client.setTimeout(800); // Milliseconds
        this.client.setID(1);
        this.timer = setTimeout(() => {
            this.pollVentilationSystem();
        }, this.POLLING_INTERVAL);
        this.reconnect(this.device?.getSetting('ip'), this.device?.getSetting('port'), !!this.device?.getSetting('tcp'));
    }

    connect(ip: string, port: number, tcpConnection = false) {
        if (tcpConnection) {
            this.client
                .connectTCP(ip, { port })
                .then(() => this.onConnected())
                .catch((err) => this.onFailedToConnect(err));
        } else {
            this.client
                .connectTelnet(ip, { port })
                .then(() => this.onConnected())
                .catch((err) => this.onFailedToConnect(err));
        }
    }

    onConnected() {
        this.isConnected = true;
        this.device?.log(`Connected to ${this.device?.getSettings().ip}:${this.device?.getSettings().port}`);
    }

    onFailedToConnect(err: string) {
        this.isConnected = false;
        this.device?.log(`Unable to connect to ${this.device?.getSettings().ip}:${this.device?.getSettings().port} --> ${err}`);
        this.device?.setUnavailable(`Unable to connect to ${this.device?.getSettings().ip}:${this.device?.getSettings().port}`).catch((err) => this.device?.error(`Failed to set unavailable: ${err}`));
    }

    reconnect(ip: string, port: number, tcpConnection = false) {
        this.reconnectCounter = 0;
        this.client.close(() => {
            this.device?.log('Reconnecting...');
        });
        this.connect(ip, port, tcpConnection);
    }

    checkConnection() {
        if (this.reconnectCounter > 5) {
            this.reconnect(this.device?.getSetting('ip'), this.device?.getSetting('port'), !!this.device?.getSetting('tcp'));
        } else {
            this.reconnectCounter += 1;
        }
    }

    async writeModbus() {
        const coilQueue = this.writeQueue['coils'];
        const holdingRegisters = this.writeQueue['holdingRegisters'];
        try {
            for (const coil of coilQueue) {
                const result = await this.client.writeCoils(coil.startingAddress, coil.values);
                if (result) this.device?.log('Successfully wrote to coils starting at ', coil.startingAddress, ' --> ', coil.values);
            }
            for (const holdingRegister of holdingRegisters) {
                const result = await this.client.writeRegisters(holdingRegister.startingAddress, holdingRegister.values);
                if (result) this.device?.log('Successfully wrote to registers starting at ', holdingRegister.startingAddress, ' --> ', holdingRegister.values);
            }
            this.writeQueue.coils = [];
            this.writeQueue.holdingRegisters = [];
        } catch (e) {
            this.device?.error('Failed to write to client', e);
        }
    }

    hasPendingWriteRequests() {
        return this.writeQueue.coils.length || this.writeQueue.holdingRegisters.length;
    }

    async pollVentilationSystem() {
        this.checkConnection();
        if (this.isConnected) {
            if (this.hasPendingWriteRequests()) {
                this.ignoreNextRead = true;
                this.device?.log('Processing write queue, going to ignore next read');
                await this.writeModbus();
            } else {
                if (!this.ignoreNextRead) {
                    try {
                        const results = await this.readRegisters(this.client);
                        this.reconnectCounter = 0;
                        this.device?.setAvailable().catch((e) => this.device?.error(`Failed to set available: ${e}`));
                        if (!this.ignoreNextRead) this.device?.processResults(results);
                        else this.device?.log('Ignored read results');
                    } catch (err) {
                        this.device
                            ?.setUnavailable(`Connected to ${this.device?.getSetting('ip')}:${this.device.getSetting('port')}, but got error: "${err}"`)
                            .catch((e) => this.device?.error(`Failed to set unavailable: ${e}`));
                        this.device?.error(err);
                    }
                } else this.device?.log('Ignored read');
                this.ignoreNextRead = false;
            }
        }
        this.timer = setTimeout(() => {
            this.pollVentilationSystem();
        }, this.POLLING_INTERVAL);
    }

    async readRegisters(client: InstanceType<typeof ModbusRTU>) {
        return new Promise<{ coils: boolean[]; discreteInputs: boolean[]; inputRegisters: number[]; holdingRegisters: number[] }>(async (resolve, reject) => {
            const result = {
                coils: [],
                discreteInputs: [],
                inputRegisters: [],
                holdingRegisters: []
            } as { coils: boolean[]; discreteInputs: boolean[]; holdingRegisters: number[]; inputRegisters: number[] };
            let coilStatus;
            let inputRegisters;
            let holdingRegisters;
            let discreteInputs;

            const timeout = setTimeout(() => {
                reject('Modbus timeout');
            }, this.POLLING_INTERVAL / 2);
            try {
                coilStatus = await client.readCoils(this.registers.coils.start, this.registers.coils.count);
                discreteInputs = await client.readDiscreteInputs(this.registers.discreteInputs.start, this.registers.discreteInputs.count);
                inputRegisters = await client.readInputRegisters(this.registers.inputRegisters.start, this.registers.inputRegisters.count);
                holdingRegisters = await client.readHoldingRegisters(this.registers.holdingRegisters.start, this.registers.holdingRegisters.count);
            } catch (err: any) {
                clearTimeout(timeout);
                reject(err?.message || 'Modbus timeout');
            }

            if (coilStatus) {
                result.coils = coilStatus.data;
            }
            if (discreteInputs) {
                result.discreteInputs = discreteInputs.data;
            }
            if (inputRegisters) {
                result.inputRegisters = inputRegisters.data;
            }
            if (holdingRegisters) {
                result.holdingRegisters = holdingRegisters.data;
            }
            clearTimeout(timeout);
            resolve(result);
        });
    }

    writeRegister(startRegister: number, value: number) {
        this.ignoreNextRead = true;
        this.device?.log('Adding registers starting at: ', startRegister, '-->', value, 'to write queue');
        this.writeQueue['holdingRegisters'].push({ values: [value], startingAddress: startRegister });
    }

    writeMultipleCoils(startCoil: number, values: boolean[]) {
        this.ignoreNextRead = true;
        this.device?.log('Adding coils starting at: ', startCoil, '-->', values, 'to write queue');
        this.writeQueue['coils'].push({ values, startingAddress: startCoil });
    }

    writeCoil(coil: number, value: boolean) {
        this.writeMultipleCoils(coil, [value]);
    }

    destroy() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.client?.close(() => {
            this.device?.log('Destroyed. Closing connection to client.');
        });
    }
}
