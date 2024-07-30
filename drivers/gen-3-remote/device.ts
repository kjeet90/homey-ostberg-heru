import BaseDevice from '../base-device';
import { HeruAPI } from '../heru-api';
import { Gen3Registers } from '../registers';
import { alarms, registers, RegulationModeGen3, SetRegulationModeGen3, FanSpeedGen3, SetFanSpeedGen3 } from './constants';
export class Gen3Remote extends BaseDevice {
    async onInit() {
        super.onInit();
        this.api = new HeruAPI(this, registers, this.getSetting('interval') || 2000);
        this.log(`${this.getName()} has been initialized`);

        this.registerCapabilityListener('regulation_mode_gen3', async (value: SetRegulationModeGen3) => {
            this.setRegulationMode(value);
            this.triggerRegulationModeChanged(value);
        });

        this.registerCapabilityListener('target_temperature', async (value) => {
            this.setTargetTemperature(value);
        });

        this.registerCapabilityListener('fan_speed_gen3', async (value: SetFanSpeedGen3) => {
            this.setFanSpeed(value);
            this.triggerFanSpeedChanged(value);
        });
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

    triggerFanSpeedChanged(value: SetFanSpeedGen3) {
        let speed = 'Unknown';
        switch (value) {
            case SetFanSpeedGen3.OFF:
                speed = 'Off';
                break;
            case SetFanSpeedGen3.MIN:
                speed = 'Minimum';
                break;
            case SetFanSpeedGen3.STD:
                speed = 'Standard';
                break;
            case SetFanSpeedGen3.MOD:
                speed = 'Medium';
                break;
            case SetFanSpeedGen3.MAX:
                speed = 'Maximum';
                break;
        }
        this.homey.flow.getDeviceTriggerCard('fan_speed_changed_gen3').trigger(this, { speed });
    }

    isFanSpeed(value: SetFanSpeedGen3) {
        return this.getCapabilityValue('fan_speed_gen3') === value;
    }

    setFanSpeed(value: SetFanSpeedGen3) {
        switch (value) {
            case SetFanSpeedGen3.OFF:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.USER_FAN_SPEED, FanSpeedGen3.OFF);
                this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.OFF).catch(this.error);
                break;
            case SetFanSpeedGen3.MIN:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.USER_FAN_SPEED, FanSpeedGen3.MIN);
                this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.MIN).catch(this.error);
                break;
            case SetFanSpeedGen3.STD:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.USER_FAN_SPEED, FanSpeedGen3.STD);
                this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.STD).catch(this.error);
                break;
            case SetFanSpeedGen3.MOD:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.USER_FAN_SPEED, FanSpeedGen3.MOD);
                this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.MOD).catch(this.error);
                break;
            case SetFanSpeedGen3.MAX:
                this.api?.writeRegister(Gen3Registers.holdingRegisters.USER_FAN_SPEED, FanSpeedGen3.MAX);
                this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.MAX).catch(this.error);
                break;
        }
    }

    async processFanSpeed(fanSpeed: FanSpeedGen3) {
        const previousFanSpeed: SetFanSpeedGen3 = this.getCapabilityValue('fan_speed_gen3');
        switch (fanSpeed) {
            case FanSpeedGen3.OFF:
                await this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.OFF).catch(this.error);
                break;
            case FanSpeedGen3.STD:
                await this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.STD).catch(this.error);
                break;
            case FanSpeedGen3.MOD:
                await this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.MOD).catch(this.error);
                break;
            case FanSpeedGen3.MAX:
                await this.setCapabilityValue('fan_speed_gen3', SetFanSpeedGen3.MAX).catch(this.error);
                break;
        }
        const newFanSpeed: SetFanSpeedGen3 = this.getCapabilityValue('fan_speed_gen3');
        if (previousFanSpeed !== newFanSpeed) this.triggerFanSpeedChanged(newFanSpeed);
    }

    processResults(results: { coils: boolean[]; discreteInputs: boolean[]; inputRegisters: number[]; holdingRegisters: number[] }): void {
        super.processResults(results);
        if (results.holdingRegisters.length) {
            this.processFanSpeed(results.holdingRegisters[Gen3Registers.holdingRegisters.USER_FAN_SPEED]);
        }
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
}

module.exports = Gen3Remote;
