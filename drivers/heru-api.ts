import ModbusRTU from 'modbus-serial';
import BaseDevice from './base-device';
interface PendingWrite {
    startingAddress: number;
    // Settle the promise returned to the caller that queued the write
    resolve: () => void;
    reject: (err: Error) => void;
}

interface WriteModbusCoils extends PendingWrite {
    values: boolean[];
    // Written with function code 5 (write single coil) instead of 15 (write multiple coils)
    single: boolean;
}

interface WriteModbusRegisters extends PendingWrite {
    values: number[];
}

// modbus-serial adds a modbusCode when the unit answers with an exception, e.g. for an unsupported register or an invalid value
function isModbusException(e: unknown): e is Error & { modbusCode: number } {
    return e instanceof Error && typeof (e as { modbusCode?: unknown }).modbusCode === 'number';
}

// modbus-serial has no request timeout of its own, so without this a lost response leaves the request waiting forever
function withTimeout<T>(request: Promise<T>, ms: number, description: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${description} timed out after ${ms} ms`)), ms);
    });
    return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

function toRanges(ranges: ModbusRanges): ModbusRange[] {
    return Array.isArray(ranges) ? ranges : [ranges];
}

export class HeruAPI {
    device?: BaseDevice;
    client: ModbusRTU;

    isConnected = false;
    consecutiveFailedRead = 0;
    consecutiveFailedWrite = 0;
    MAX_WRITE_ATTEMPTS = 5;
    // Per request, so a slow but working connection doesn't fail a whole poll
    REQUEST_TIMEOUT = 3000;
    reconnectCounter = 0;
    POLLING_INTERVAL = 2000;
    timer: NodeJS.Timeout | null = null;
    ignoreNextRead = false; // Used to prevent reading modbus straight after a command to avoid timing issues
    write = false;
    writeQueue = {
        coils: [],
        holdingRegisters: []
    } as { coils: WriteModbusCoils[]; holdingRegisters: WriteModbusRegisters[] }; //new Map<'coils' | 'holdingRegisters', WriteModbusRegisters[] | WriteModbusCoils[]>();
    // Optional ranges the unit refused, so the refusal is logged once instead of on every poll
    skippedRanges = new Set<string>();

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

    constructor(device: BaseDevice, registers: ModbusRegisters, interval: number) {
        this.POLLING_INTERVAL = interval;
        this.device = device;
        this.registers = registers;
        this.client = new ModbusRTU();
        // this.client.setTimeout(800); // Milliseconds
        this.client.setID(1);
        this.timer = setTimeout(() => {
            this.pollVentilationSystem();
        }, this.POLLING_INTERVAL);
        this.connect(this.device?.getSetting('ip'), this.device?.getSetting('port'), !!this.device?.getSetting('tcp'));
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
            this.reconnectCounter++;
        }
    }

    async writeModbus() {
        try {
            await this.processWriteQueue(this.writeQueue.coils, 'coils', (coil) =>
                withTimeout<unknown>(
                    coil.single ? this.client.writeCoil(coil.startingAddress, coil.values[0]) : this.client.writeCoils(coil.startingAddress, coil.values),
                    this.REQUEST_TIMEOUT,
                    'Writing coils'
                ));
            await this.processWriteQueue(this.writeQueue.holdingRegisters, 'registers', (register) =>
                withTimeout(this.client.writeRegisters(register.startingAddress, register.values), this.REQUEST_TIMEOUT, 'Writing registers')
            );
            this.consecutiveFailedWrite = 0;
        } catch (e) {
            // Only connection problems end up here, so retry the remaining writes on the next poll
            this.consecutiveFailedWrite++;
            this.device?.error(`Failed to write to client (attempt ${this.consecutiveFailedWrite}/${this.MAX_WRITE_ATTEMPTS})`, e);
            if (this.consecutiveFailedWrite >= this.MAX_WRITE_ATTEMPTS) {
                this.device?.error('Giving up on pending writes, clearing write queue', this.writeQueue);
                this.rejectPendingWrites(`Could not write to the unit: ${e instanceof Error ? e.message : e}`);
            }
        }
    }

    async processWriteQueue<T extends WriteModbusCoils | WriteModbusRegisters>(queue: T[], type: string, write: (pendingWrite: T) => Promise<unknown>) {
        // Remove each item only after it was handled, so a retry doesn't repeat writes that already succeeded
        while (queue.length) {
            const pendingWrite = queue[0];
            try {
                await write(pendingWrite);
            } catch (e) {
                if (!isModbusException(e)) throw e;
                // The unit answered but refused this write, so retrying won't help. Fail only this write and carry on with the rest.
                this.device?.error(`The unit rejected the write to ${type} starting at`, pendingWrite.startingAddress, '-->', pendingWrite.values, e.message);
                queue.shift();
                pendingWrite.reject(new Error(`The unit rejected the new value: ${e.message}`));
                continue;
            }
            this.device?.log(`Successfully wrote to ${type} starting at `, pendingWrite.startingAddress, ' --> ', pendingWrite.values);
            queue.shift();
            pendingWrite.resolve();
        }
    }

    rejectPendingWrites(message: string) {
        // Empty the queues in place, as processWriteQueue may still hold a reference to them
        const pendingWrites = [...this.writeQueue.coils.splice(0), ...this.writeQueue.holdingRegisters.splice(0)];
        this.consecutiveFailedWrite = 0;
        pendingWrites.forEach((pendingWrite) => pendingWrite.reject(new Error(message)));
    }

    hasPendingWriteRequests() {
        return this.writeQueue.coils.length || this.writeQueue.holdingRegisters.length;
    }

    async pollVentilationSystem() {
        try {
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
                            this.consecutiveFailedRead = 0;
                            this.device?.setAvailable().catch((e) => this.device?.error(`Failed to set available: ${e}`));
                            if (!this.ignoreNextRead) this.device?.processResults(results);
                            else this.device?.log('Ignored read results');
                        } catch (err) {
                            if (this.consecutiveFailedRead < 2) {
                                this.consecutiveFailedRead++;
                            } else {
                                this.device
                                    ?.setUnavailable(`Connected to ${this.device?.getSetting('ip')}:${this.device.getSetting('port')}, but got error: "${err}"`)
                                    .catch((e) => this.device?.error(`Failed to set unavailable: ${e}`));
                            }
                            this.device?.error(err);
                        }
                    } else this.device?.log('Ignored read');
                    this.ignoreNextRead = false;
                }
            } else if (this.hasPendingWriteRequests()) {
                this.rejectPendingWrites('Not connected to the unit');
            }
        } catch (err) {
            this.device?.error('Polling failed', err);
        } finally {
            this.timer = setTimeout(() => {
                this.pollVentilationSystem();
            }, this.POLLING_INTERVAL);
        }
    }

    async readRegisters(client: InstanceType<typeof ModbusRTU>) {
        const { coils, discreteInputs, inputRegisters, holdingRegisters } = this.registers;
        // One request at a time: the RTU-over-TCP connection can only match one response to one request
        return {
            coils: await this.readRanges(coils, 'coils', (start, count) => client.readCoils(start, count)),
            discreteInputs: await this.readRanges(discreteInputs, 'discrete inputs', (start, count) => client.readDiscreteInputs(start, count)),
            inputRegisters: await this.readRanges(inputRegisters, 'input registers', (start, count) => client.readInputRegisters(start, count)),
            holdingRegisters: await this.readRanges(holdingRegisters, 'holding registers', (start, count) => client.readHoldingRegisters(start, count))
        };
    }

    // Index every value by its register address, so the register enums can be used directly even when a range doesn't start at 0.
    // Addresses in a skipped optional range stay undefined.
    async readRanges<T>(ranges: ModbusRanges, type: string, read: (start: number, count: number) => Promise<{ data: T[] }>): Promise<T[]> {
        const values: T[] = [];
        for (const range of toRanges(ranges)) {
            const description = `Reading ${type} ${range.start}-${range.start + range.count - 1}`;
            try {
                const { data } = await withTimeout(read(range.start, range.count), this.REQUEST_TIMEOUT, description);
                // Coils come back padded to a whole byte, so only take the requested count
                data.slice(0, range.count).forEach((value, i) => (values[range.start + i] = value));
                this.skippedRanges.delete(description);
            } catch (e) {
                if (!range.optional || !isModbusException(e)) throw e;
                if (!this.skippedRanges.has(description)) {
                    this.skippedRanges.add(description);
                    this.device?.log(`${description} was refused by the unit, skipping it --> ${e.message}`);
                }
            }
        }
        return values;
    }

    writeRegister(startRegister: number, value: number): Promise<void> {
        return this.writeRegisters(startRegister, [value]);
    }

    // The returned promise resolves once the values are written to the unit, and rejects if the write is dropped
    writeRegisters(startRegister: number, values: number[]): Promise<void> {
        if (!this.isConnected) return Promise.reject(new Error('Not connected to the unit'));
        this.ignoreNextRead = true;
        this.device?.log('Adding registers starting at: ', startRegister, '-->', values, 'to write queue');
        return new Promise((resolve, reject) => {
            this.writeQueue['holdingRegisters'].push({ values, startingAddress: startRegister, resolve, reject });
        });
    }

    // The returned promise resolves once the values are written to the unit, and rejects if the write is dropped
    writeMultipleCoils(startCoil: number, values: boolean[]): Promise<void> {
        return this.queueCoilWrite(startCoil, values, false);
    }

    // Some coils, like the ones that trigger an action, are only accepted as a single coil write
    writeCoil(coil: number, value: boolean): Promise<void> {
        return this.queueCoilWrite(coil, [value], true);
    }

    queueCoilWrite(startCoil: number, values: boolean[], single: boolean): Promise<void> {
        if (!this.isConnected) return Promise.reject(new Error('Not connected to the unit'));
        this.ignoreNextRead = true;
        this.device?.log('Adding coils starting at: ', startCoil, '-->', values, 'to write queue');
        return new Promise((resolve, reject) => {
            this.writeQueue['coils'].push({ values, startingAddress: startCoil, single, resolve, reject });
        });
    }

    destroy() {
        this.rejectPendingWrites('The device was removed');
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.client?.close(() => {
            this.device?.log('Destroyed. Closing connection to client.');
        });
    }

    setPollingInterval(interval: number) {
        this.device?.log(`Polling interval set to: ${interval}ms`);
        this.POLLING_INTERVAL = interval;
    }
}
