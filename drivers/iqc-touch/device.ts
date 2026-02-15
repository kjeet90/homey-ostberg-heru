import BaseDevice from '../base-device';
import { HeruAPI } from '../heru-api';
import { IQCRegisters } from '../registers';
import { alarms, registers, SetRegulationModeIQC, RegulationModeIQC } from './constants';

class IQCTouch extends BaseDevice {
    async onInit() {
        super.onInit();
        await this.upgradeExistingDevice();

        const iqcRegisters: ModbusRegisters = { ...registers, holdingRegisters: { start: 0, count: 67 } };

        this.api = new HeruAPI(this, iqcRegisters, this.getSetting('interval') ?? 2000);
        this.log(`${this.getName()} has been initialized`);
        this.registerCapabilityListener('regulation_mode_iqc', async (value: SetRegulationModeIQC) => {
            this.setRegulationMode(value);
            this.triggerRegulationModeChanged(value);
        });
        this.registerCapabilityListener('target_temperature', async (value) => {
            this.setTargetTemperature(value, false);
        });
        this.registerCapabilityListener('target_temperature.eco', async (value) => {
            this.setTargetTemperature(value, true);
        });
        this.registerCapabilityListener('heater_enabled_iqc', async (value) => {
            this.setHeaterEnabled(value);
        });
        this.registerCapabilityListener('preheater_enabled_iqc', async (value) => {
            this.setPreheaterEnabled(value);
        });
    }

    async upgradeExistingDevice() {
        if (!this.hasCapability('preheater_enabled_iqc')) await this.addCapability('preheater_enabled_iqc');
        if (!this.hasCapability('heater_enabled_iqc')) await this.addCapability('heater_enabled_iqc');
        if (!this.hasCapability('meter_thermal_efficiency')) await this.addCapability('meter_thermal_efficiency');
    }

    async setTargetTemperature(target: number, eco: boolean) {
        if (eco) this.api?.writeRegister(IQCRegisters.holdingRegisters.SETPOINT_TEMPERATURE_ECONOMY, target);
        else this.api?.writeRegister(IQCRegisters.holdingRegisters.SETPOINT_TEMPERATURE, target);
    }

    async setHeaterEnabled(value: boolean) {
        this.api?.writeRegister(IQCRegisters.holdingRegisters.HEATER_ENABLED, value ? 1 : 0);
    }

    async setPreheaterEnabled(value: boolean) {
        this.api?.writeRegister(IQCRegisters.holdingRegisters.PREHEATER_ENABLED, value ? 1 : 0);
    }

    async onAdded() {
        this.log('IQC Touch device has been added with the following settings: ', this.getSettings());
    }

    async onDeleted() {
        super.onDeleted();
        this.log(`IQC Touch device ${this.getName()} deleted`);
    }

    triggerRegulationModeChanged(value: SetRegulationModeIQC) {
        let mode = 'Unknown';
        switch (value) {
            case SetRegulationModeIQC.SUPPLY:
                mode = 'Supply air';
                break;
            case SetRegulationModeIQC.EXTRACT:
                mode = 'Extract air';
                break;
            case SetRegulationModeIQC.ROOM:
                mode = 'Room';
                break;
            case SetRegulationModeIQC.ROOM_SW:
                mode = 'Room S/W';
                break;
            case SetRegulationModeIQC.EXTRACT_SW:
                mode = 'Extract S/W';
                break;
        }
        this.homey.flow.getDeviceTriggerCard('regulation_mode_changed_iqc').trigger(this, { mode });
    }

    isRegulationMode(value: SetRegulationModeIQC) {
        return this.getCapabilityValue('regulation_mode_iqc') === value;
    }

    setRegulationMode(value: SetRegulationModeIQC) {
        switch (value) {
            case SetRegulationModeIQC.SUPPLY:
                this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.SUPPLY);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                break;
            case SetRegulationModeIQC.EXTRACT:
                this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.EXTRACT);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case SetRegulationModeIQC.ROOM:
                this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.ROOM);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
            case SetRegulationModeIQC.EXTRACT_SW:
                this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.EXTRACT_SW);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case SetRegulationModeIQC.ROOM_SW:
                this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.ROOM_SW);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
        }
    }

    async processRegulationMode(regulationMode: RegulationModeIQC, targetTemperature: number) {
        const previousRegulationMode = this.getCapabilityValue('regulation_mode_iqc');
        switch (regulationMode) {
            case RegulationModeIQC.EXTRACT_SW:
                await this.setCapabilityValue('regulation_mode_iqc', 'extract_sw').catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case RegulationModeIQC.ROOM_SW:
                await this.setCapabilityValue('regulation_mode_iqc', 'room_sw').catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
            case RegulationModeIQC.SUPPLY:
                await this.setCapabilityValue('regulation_mode_iqc', 'supply').catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                break;
            case RegulationModeIQC.EXTRACT:
                await this.setCapabilityValue('regulation_mode_iqc', 'extract').catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case RegulationModeIQC.ROOM:
                await this.setCapabilityValue('regulation_mode_iqc', 'room').catch(this.error);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
        }
        this.setCapabilityValue('target_temperature', targetTemperature).catch(this.error);

        const newRegulationMode: SetRegulationModeIQC = this.getCapabilityValue('regulation_mode_iqc');
        if (previousRegulationMode !== newRegulationMode) this.triggerRegulationModeChanged(newRegulationMode);
    }

    processResults(results: { coils: boolean[]; discreteInputs: boolean[]; inputRegisters: number[]; holdingRegisters: number[] }): void {
        super.processResults(results);
        this.setCapabilityValue('target_temperature.eco', results.holdingRegisters[IQCRegisters.holdingRegisters.SETPOINT_TEMPERATURE_ECONOMY]);
        this.setCapabilityValue('heater_enabled_iqc', !!results.holdingRegisters[IQCRegisters.holdingRegisters.HEATER_ENABLED]);
        this.setCapabilityValue('preheater_enabled_iqc', !!results.holdingRegisters[IQCRegisters.holdingRegisters.PREHEATER_ENABLED]);
    }

    async processAlarms(discreteInputs: boolean[]): Promise<void> {
        const previousAlarms: { [index: string]: boolean } = this.getStoreValue('alarms') || {};
        const currentAlarms: { [index: string]: boolean } = {} as { [index: string]: boolean };
        currentAlarms['fire_alarm'] = discreteInputs[IQCRegisters.discreteInputs.FIRE_ALARM];
        currentAlarms['rotor_alarm'] = discreteInputs[IQCRegisters.discreteInputs.ROTOR_ALARM];
        currentAlarms['freeze_alarm'] = discreteInputs[IQCRegisters.discreteInputs.FREEZE_ALARM];
        currentAlarms['low_supply_alarm'] = discreteInputs[IQCRegisters.discreteInputs.LOW_SUPPLY_ALARM];
        currentAlarms['low_rotor_temperature_alarm'] = discreteInputs[IQCRegisters.discreteInputs.LOW_ROTOR_TEMPEARTURE_ALARM];
        currentAlarms['temp_sensor_open_circuit_alarm'] = discreteInputs[IQCRegisters.discreteInputs.TEMP_SENSOR_OPEN_CIRCUIT_ALARM];
        currentAlarms['temp_sensor_short_circut_alarm'] = discreteInputs[IQCRegisters.discreteInputs.TEMP_SENSOR_SHORT_CIRCUIT_ALARM];
        currentAlarms['pulser_alarm'] = discreteInputs[IQCRegisters.discreteInputs.PULSER_ALARM];
        currentAlarms['supply_fan_alarm'] = discreteInputs[IQCRegisters.discreteInputs.SUPPLY_FAN_ALARM];
        currentAlarms['extract_fan_alarm'] = discreteInputs[IQCRegisters.discreteInputs.EXHAUST_FAN_ALARM];
        currentAlarms['supply_filter_alarm'] = discreteInputs[IQCRegisters.discreteInputs.SUPPLY_FILTER_ALARM];
        currentAlarms['extract_filter_alarm'] = discreteInputs[IQCRegisters.discreteInputs.EXHAUST_FILTER_ALARM];
        currentAlarms['filter_timer_alarm'] = discreteInputs[IQCRegisters.discreteInputs.FILTER_TIMER_ALARM];
        currentAlarms['pump_alarm_heating'] = discreteInputs[IQCRegisters.discreteInputs.PUMP_ALARM_HEATING];
        currentAlarms['pump_alarm_cooling'] = discreteInputs[IQCRegisters.discreteInputs.PUMP_ALARM_COOLING];
        const activeAlarms = await this.checkAlarmTriggers(currentAlarms, previousAlarms, alarms);
        if (this.hasCapability('alarm_active_alarms')) {
            this.setCapabilityValue('alarm_active_alarms', !!activeAlarms.length).catch(this.error);
        }
    }

    listActiveAlarms() {
        const currentAlarms = this.getStoreValue('alarms');
        return {
            allActive: this.getActiveAlarmsString(currentAlarms, alarms)
        };
    }
}

module.exports = IQCTouch;
