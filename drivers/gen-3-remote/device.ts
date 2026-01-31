import BaseDevice from '../base-device';
import { HeruAPI } from '../heru-api';
import { Gen3HoldingRegisters, Gen3Registers } from '../registers';
import { alarms, registers, RegulationModeGen3, SetRegulationModeGen3 } from './constants';
import { convertArrayOfBooleansToNumber, convertNumberToArrayOfBooleans } from './utils';

export class Gen3Remote extends BaseDevice {
    async onInit() {
        super.onInit();
        await this.upgradeExistingDevice();
        this.api = new HeruAPI(this, registers, this.getSetting('interval') || 2000);
        this.log(`${this.getName()} has been initialized`);

        this.registerCapabilityListener('regulation_mode_gen3', async (value: SetRegulationModeGen3) => {
            this.setRegulationMode(value);
            this.triggerRegulationModeChanged(value);
        });

        this.registerCapabilityListener('target_temperature', async (value) => {
            this.setTargetTemperature(value);
        });

        this.registerCapabilityListener('heater_enabled_gen3', async (value) => {
            this.setHeaterEnabled(value);
        });
    }

    async upgradeExistingDevice() {
        if (!this.hasCapability('heater_enabled_gen3')) await this.addCapability('heater_enabled_gen3');
    }

    async setHeaterEnabled(value: boolean) {
        this.api?.writeRegister(Gen3Registers.holdingRegisters.HEATER_ENABLED, value ? 1 : 0);
    }

    async setWeekTimerEnabled(value: boolean) {
        this.api?.writeRegister(Gen3Registers.holdingRegisters.WEEK_TIMER_ENABLED, value ? 1 : 0);
    }

    async updateWeekProgram(program: number, weekdays: number, onHour:number, onMinute: number, offHour: number, offMinute: number, temperature: number, fanSpeed: number) {
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_WEEKDAYS` as keyof typeof Gen3HoldingRegisters], weekdays);
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_START_HOUR` as keyof typeof Gen3HoldingRegisters], onHour);
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_START_MINUTE` as keyof typeof Gen3HoldingRegisters], onMinute);
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_END_HOUR` as keyof typeof Gen3HoldingRegisters], offHour);
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_END_MINUTE` as keyof typeof Gen3HoldingRegisters], offMinute);
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_FAN_SPEED` as keyof typeof Gen3HoldingRegisters], fanSpeed);
        this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_TEMPERATURE` as keyof typeof Gen3HoldingRegisters], temperature);
    }

    setTargetTemperature(target: number) {
        this.api?.writeRegister(Gen3Registers.holdingRegisters.SETPOINT_TEMPERATURE, target);
    }

    async onAdded() {
        this.log('Gen 3 Remote device has been added with the following settings: ', this.getSettings());
    }

    async onDeleted() {
        super.onDeleted();
        this.log(`Gen3Remote device ${this.getName()} deleted`);
    }

    triggerRegulationModeChanged(value: SetRegulationModeGen3) {
        let mode = 'Unknown';
        switch (value) {
            case SetRegulationModeGen3.SUPPLY:
                mode = 'Supply air';
                break;
            case SetRegulationModeGen3.EXTRACT:
                mode = 'Extract air';
                break;
            case SetRegulationModeGen3.ROOM:
                mode = 'Room';
                break;
        }
        this.homey.flow.getDeviceTriggerCard('regulation_mode_changed_gen3').trigger(this, { mode });
    }

    isRegulationMode(value: SetRegulationModeGen3) {
        return this.getCapabilityValue('regulation_mode_gen3') === value;
    }

    setRegulationMode(value: SetRegulationModeGen3) {
        switch (value) {
            case SetRegulationModeGen3.SUPPLY:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.REGULATION_MODE, RegulationModeGen3.SUPPLY);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                break;
            case SetRegulationModeGen3.EXTRACT:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.REGULATION_MODE, RegulationModeGen3.EXTRACT);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case SetRegulationModeGen3.ROOM:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.REGULATION_MODE, RegulationModeGen3.ROOM);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
        }
    }

    async processRegulationMode(regulationMode: RegulationModeGen3, targetTemperature: number) {
        const previousRegulationMode = this.getCapabilityValue('regulation_mode_gen3');
        switch (regulationMode) {
            case RegulationModeGen3.SUPPLY:
                await this.setCapabilityValue('regulation_mode_gen3', SetRegulationModeGen3.SUPPLY).catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                break;
            case RegulationModeGen3.EXTRACT:
                await this.setCapabilityValue('regulation_mode_gen3', SetRegulationModeGen3.EXTRACT).catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case RegulationModeGen3.ROOM:
                await this.setCapabilityValue('regulation_mode_gen3', SetRegulationModeGen3.ROOM).catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
        }
        this.setCapabilityValue('target_temperature', targetTemperature).catch(this.error);
        const newRegulationMode: SetRegulationModeGen3 = this.getCapabilityValue('regulation_mode_gen3');
        if (previousRegulationMode !== newRegulationMode) this.triggerRegulationModeChanged(newRegulationMode);
    }

    async processAlarms(discreteInputs: boolean[]): Promise<void> {
        const previousAlarms: { [index: string]: boolean } = this.getStoreValue('alarms') || {};
        const currentAlarms: { [index: string]: boolean } = {} as { [index: string]: boolean };
        currentAlarms['fire_alarm'] = discreteInputs[Gen3Registers.discreteInputs.FIRE_ALARM];
        currentAlarms['rotor_alarm'] = discreteInputs[Gen3Registers.discreteInputs.ROTOR_ALARM];
        currentAlarms['freeze_alarm'] = discreteInputs[Gen3Registers.discreteInputs.FREEZE_ALARM];
        currentAlarms['low_supply_alarm'] = discreteInputs[Gen3Registers.discreteInputs.LOW_SUPPLY_ALARM];
        currentAlarms['low_rotor_temperature_alarm'] = discreteInputs[Gen3Registers.discreteInputs.LOW_ROTOR_TEMPEARTURE_ALARM];
        currentAlarms['temp_sensor_open_circuit_alarm'] = discreteInputs[Gen3Registers.discreteInputs.TEMP_SENSOR_OPEN_CIRCUIT_ALARM];
        currentAlarms['temp_sensor_short_circut_alarm'] = discreteInputs[Gen3Registers.discreteInputs.TEMP_SENSOR_SHORT_CIRCUIT_ALARM];
        currentAlarms['pulser_alarm'] = discreteInputs[Gen3Registers.discreteInputs.PULSER_ALARM];
        currentAlarms['supply_fan_alarm'] = discreteInputs[Gen3Registers.discreteInputs.SUPPLY_FAN_ALARM];
        currentAlarms['extract_fan_alarm'] = discreteInputs[Gen3Registers.discreteInputs.EXHAUST_FAN_ALARM];
        currentAlarms['supply_filter_alarm'] = discreteInputs[Gen3Registers.discreteInputs.SUPPLY_FILTER_ALARM];
        currentAlarms['extract_filter_alarm'] = discreteInputs[Gen3Registers.discreteInputs.EXHAUST_FILTER_ALARM];
        currentAlarms['filter_timer_alarm'] = discreteInputs[Gen3Registers.discreteInputs.FILTER_TIMER_ALARM];
        currentAlarms['carbondioxide_boost_alarm'] = discreteInputs[Gen3Registers.discreteInputs.CO2_BOOST];
        const activeAlarms = await this.checkAlarmTriggers(currentAlarms, previousAlarms, alarms);
        if (this.hasCapability('alarm_active_alarms')) {
            this.setCapabilityValue('alarm_active_alarms', !!activeAlarms.length).catch((err) => this.error(err));
        }
    }

    listActiveAlarms() {
        const currentAlarms = this.getStoreValue('alarms');
        return {
            allActive: this.getActiveAlarmsString(currentAlarms, alarms)
        };
    }

    async onSettings(event: {
        oldSettings: { [p: string]: any };
        newSettings: { [p: string]: any };
        changedKeys: string[]
    }): Promise<string | void> {
        super.onSettings(event);

        if (event.changedKeys.includes('week_timer_enabled')) {
            this.setWeekTimerEnabled(event.newSettings['week_timer_enabled']);
        }

        [...Array(5)].forEach((_, key) => {
            const program = key+1;
            if (event.changedKeys.some((item) => item.includes(`program_${program}`))) {
                this.updateWeekProgram(
                    program,
                    convertArrayOfBooleansToNumber([
                        event.newSettings[`program_${program}_sunday`],
                        event.newSettings[`program_${program}_saturday`],
                        event.newSettings[`program_${program}_friday`],
                        event.newSettings[`program_${program}_thursday`],
                        event.newSettings[`program_${program}_wednesday`],
                        event.newSettings[`program_${program}_tuesday`],
                        event.newSettings[`program_${program}_monday`]
                    ]),
                    event.newSettings[`program_${program}_start_hour`],
                    event.newSettings[`program_${program}_start_minute`],
                    event.newSettings[`program_${program}_end_hour`],
                    event.newSettings[`program_${program}_end_minute`],
                    event.newSettings[`program_${program}_temperature`],
                    event.newSettings[`program_${program}_fan_speed`])
            }
        })

    }

    processResults(results: { coils: boolean[]; discreteInputs: boolean[]; inputRegisters: number[]; holdingRegisters: number[] }): void {
        super.processResults(results);

        if (results) {
            if (results.inputRegisters.length) {
                // Inputs Registers
                if (this.hasCapability('meter_carbondioxide_gen3')) {
                    this.setCapabilityValue('meter_carbondioxide_gen3', results.inputRegisters[Gen3Registers.inputRegisters.CARBON_DIOXIDE]).catch(this.error);
                }
            }

            if (results.holdingRegisters.length) {
                // Holding Registers
                this.setCapabilityValue('heater_enabled_gen3', !!results.holdingRegisters[Gen3Registers.holdingRegisters.HEATER_ENABLED]);
                const programSettings = Array.from({ length: 5 }).map((_, i) => {
                    const program = i+1;
                    const weekdays = convertNumberToArrayOfBooleans(results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_WEEKDAYS` as keyof typeof Gen3HoldingRegisters]], 7);

                    return {
                        [`program_${program}_monday`]: weekdays[6],
                        [`program_${program}_tuesday`]: weekdays[5],
                        [`program_${program}_wednesday`]: weekdays[4],
                        [`program_${program}_thursday`]: weekdays[3],
                        [`program_${program}_friday`]: weekdays[2],
                        [`program_${program}_saturday`]: weekdays[1],
                        [`program_${program}_sunday`]: weekdays[0],
                        [`program_${program}_start_hour`]: results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_START_HOUR` as keyof typeof Gen3HoldingRegisters]],
                        [`program_${program}_start_minute`]: results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_START_MINUTE` as keyof typeof Gen3HoldingRegisters]],
                        [`program_${program}_end_hour`]: results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_END_HOUR` as keyof typeof Gen3HoldingRegisters]],
                        [`program_${program}_end_minute`]: results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_END_MINUTE` as keyof typeof Gen3HoldingRegisters]],
                        [`program_${program}_temperature`]: results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_TEMPERATURE` as keyof typeof Gen3HoldingRegisters]],
                        [`program_${program}_fan_speed`]: results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_FAN_SPEED` as keyof typeof Gen3HoldingRegisters]].toString(10)
                    }
                }).reduce((acc, current) => {
                    return Object.assign(acc, current);
                }, {})

                this.setSettings({
                    'week_timer_enabled': !!results.holdingRegisters[Gen3Registers.holdingRegisters.WEEK_TIMER_ENABLED],
                    ...programSettings
                } );
            }
        }

    }
}

module.exports = Gen3Remote;
