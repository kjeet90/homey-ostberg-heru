import Homey from 'homey';
import { HeruAPI } from './heru-api';
import { SetRegulationModeGen3, RegulationModeGen3 } from './gen-3-remote/constants';
import { SetRegulationModeIQC, RegulationModeIQC } from './iqc-touch/constants';
import { BaseRegisters } from './registers';

enum FanMode {
    OFF = 'off',
    OVERPRESSURE = 'overpressure',
    BOOST = 'boost',
    NORMAL = 'normal',
    AWAY = 'away'
}

abstract class BaseDevice extends Homey.Device {
    api: HeruAPI | null = null;
    alarmNames: { [index: string]: string } | null = null;

    async onInit() {
        this.registerCapabilityListener('fan_mode', async (value: FanMode) => {
            this.setFanMode(value);
            this.triggerFanModeChanged(value);
        });
        this.addOrRemoveCapabilities().catch(this.error);
    }

    async isFanMode(value: FanMode) {
        return this.getCapabilityValue('fan_mode') === value;
    }

    abstract isRegulationMode(value: SetRegulationModeGen3 | SetRegulationModeIQC): boolean;

    setFanMode(value: FanMode) {
        switch (value) {
            case FanMode.OFF:
                this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [false, false, false, false]);
                break;
            case FanMode.OVERPRESSURE:
                this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, true, false, false]);
                break;
            case FanMode.BOOST:
                this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, false, true, false]);
                break;
            case FanMode.NORMAL:
                this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, false, false, false]);
                break;
            case FanMode.AWAY:
                this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, false, false, true]);
                break;
        }
    }

    // TODO: This seems to not work on my Gen 3 system. Investigate later. Removed .homeycompose flow actions
    // async resetAlarms() {
    //     this.api?.writeCoil(BaseRegisters.coils.CLEAR_ALARMS, true);
    // }

    // TODO: This seems to not work on my Gen 3 system. Investigate later. Removed .homeycompose flow actions
    // async resetFilterTimer() {
    //     this.api?.writeCoil(BaseRegisters.coils.RESET_FILTER_TIMER, true);
    // }

    abstract setRegulationMode(value: SetRegulationModeGen3 | SetRegulationModeIQC): void;

    abstract triggerRegulationModeChanged(value: SetRegulationModeGen3 | SetRegulationModeIQC): void;

    abstract processRegulationMode(regulationMode: RegulationModeGen3 | RegulationModeIQC, targetTemperature: number): void;

    triggerFanModeChanged(value: FanMode) {
        this.homey.flow.getDeviceTriggerCard('fan_mode_changed').trigger(this, { mode: value.charAt(0).toUpperCase() + value.slice(1) });
    }

    async processFanMode(off: boolean, overpressure: boolean, boost: boolean, away: boolean) {
        const previousFanMode = this.getCapabilityValue('fan_mode');
        if (off) {
            await this.setCapabilityValue('fan_mode', FanMode.OFF).catch(this.error);
        } else if (overpressure && !boost) {
            await this.setCapabilityValue('fan_mode', FanMode.OVERPRESSURE).catch(this.error);
        } else if (!overpressure && boost) {
            await this.setCapabilityValue('fan_mode', FanMode.BOOST).catch(this.error);
        } else if (away) {
            await this.setCapabilityValue('fan_mode', FanMode.AWAY).catch(this.error);
        } else {
            await this.setCapabilityValue('fan_mode', FanMode.NORMAL).catch(this.error);
        }
        const newFanMode = this.getCapabilityValue('fan_mode');
        if (previousFanMode !== newFanMode) this.triggerFanModeChanged(newFanMode);
    }

    isSpecificAlarmActive(alarm: string) {
        const currentAlarms = this.getStoreValue('alarms');
        return !!currentAlarms[alarm];
    }

    isAnyAlarmActive() {
        const currentAlarms = this.getStoreValue('alarms');
        return !!Object.keys(currentAlarms).some((k) => {
            const triggerOnLow = !!this.getSetting('alarm_invert_' + k);
            return (currentAlarms[k] && !triggerOnLow) || (!currentAlarms[k] && triggerOnLow);
        });
    }

    abstract listActiveAlarms(): { allActive: string };

    getActiveAlarmsString(alarmStates: { [index: string]: boolean }, alarmNames: { [index: string]: string }): string {
        return Object.keys(alarmStates)
            .filter((id: string) => {
                const triggerOnLow = !!this.getSetting('alarm_invert_' + id);
                return (alarmStates[id] && !triggerOnLow) || (!alarmStates[id] && triggerOnLow);
            })
            .map((id: string) => alarmNames[id])
            .join(', ');
    }

    async checkAlarmTriggers(currentAlarms: { [index: string]: boolean }, previousAlarms: { [index: string]: boolean }, alarmNames: { [index: string]: string }): Promise<string> {
        const activeAlarms = this.getActiveAlarmsString(currentAlarms, alarmNames);
        Object.keys(currentAlarms).forEach((k) => {
            if (currentAlarms[k] !== previousAlarms[k]) {
                this.log(`Alarm changed: ${k}, previous: ${previousAlarms[k]}, new: ${currentAlarms[k]}`);
                const triggerOnLow = !!this.getSetting('alarm_invert_' + k);
                const alarmActive = (currentAlarms[k] && !triggerOnLow) || (!currentAlarms[k] && triggerOnLow);
                if (alarmActive) {
                    this.homey.flow.getDeviceTriggerCard('specific_alarm_activated').trigger(this, { alarm: k, name: alarmNames[k] }, { id: k }).catch(this.error);
                    this.homey.flow.getDeviceTriggerCard('alarm_activated').trigger(this, { name: alarmNames[k], allActive: activeAlarms }).catch(this.error);
                    this.log(`Alarm activated: key: ${k}, name: ${alarmNames[k]}, trigger on low: ${triggerOnLow}`);
                } else {
                    this.homey.flow.getDeviceTriggerCard('specific_alarm_reset').trigger(this, { alarm: k, name: alarmNames[k] }, { id: k }).catch(this.error);
                    this.homey.flow.getDeviceTriggerCard('alarm_reset').trigger(this, { name: alarmNames[k], allActive: activeAlarms }).catch(this.error);
                    this.log(`Alarm reset: key: ${k}, name: ${alarmNames[k]}, trigger on low: ${triggerOnLow}`);
                }
            }
        });
        await this.setStoreValue('alarms', currentAlarms).catch(this.error);
        return activeAlarms;
    }

    abstract processAlarms(discreteInputs: boolean[]): void;

    approximateMeasurePower(exhaustFanPercent: number, supplyFanPercent: number, heatingPercent: number) {
        const ratedPowerFan = this.getSetting('rated_power_fan')
        const ratedPowerHeatingElement = this.getSetting('rated_power_heating_element');
        const exhaustFanWatt = (exhaustFanPercent / 100) * (ratedPowerFan / 2);
        const supplyFanWatt = (supplyFanPercent / 100) * (ratedPowerFan / 2);
        const heatingElementWatt = ((heatingPercent / 100) * ratedPowerHeatingElement);
        let totalWatt = exhaustFanWatt + supplyFanWatt + heatingElementWatt;

        if (!this.getCapabilityValue(FanMode.OFF) && this.api) {
            switch (this.getCapabilityValue('fan_mode')) {
                case FanMode.NORMAL:
                    totalWatt += this.getSetting('adjust_power_normal');
                    break;
                case FanMode.OVERPRESSURE:
                    totalWatt += this.getSetting('adjust_power_overpressure');
                    break;
                case FanMode.BOOST:
                    totalWatt += this.getSetting('adjust_power_boost');
                    break;
                case FanMode.AWAY:
                    totalWatt += this.getSetting('adjust_power_away');
                    break;
            }

            const timeSeconds = this.api.POLLING_INTERVAL / 1000;
            const energyKWh = (totalWatt * timeSeconds) / (1000 * 3600);
            if (this.hasCapability('measure_power')) this.setCapabilityValue('measure_power', totalWatt).catch(this.error);
            if (this.hasCapability('meter_power')) this.setCapabilityValue('meter_power', this.getCapabilityValue("meter_power") + energyKWh).catch(this.error);
        } else {
            if (this.hasCapability('meter_power')) this.setCapabilityValue('measure_power', 0).catch(this.error);
        }
    }

    processResults(results: { coils: boolean[]; discreteInputs: boolean[]; inputRegisters: number[]; holdingRegisters: number[] }) {
        // Coils
        if (results.coils.length) {
            this.processFanMode(
                !results.coils[BaseRegisters.coils.UNIT_ON],
                results.coils[BaseRegisters.coils.OVERPRESSURE],
                results.coils[BaseRegisters.coils.BOOST],
                results.coils[BaseRegisters.coils.AWAY]
            );
        }

        // Discrete inputs
        if (results.discreteInputs.length) {
            this.processAlarms(results.discreteInputs);
        }

        if (results)
            if (results.inputRegisters.length) {
                // Inputs Registers
                this.setCapabilityValue('meter_temperature_outdoor_air', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.OUTDOOR_TEMPERATURE])).catch(this.error);
                this.setCapabilityValue('meter_temperature_supply_air', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.SUPPLY_AIR_TEMPERATURE])).catch(this.error);
                this.setCapabilityValue('meter_temperature_extract_air', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.EXTRACT_AIR_TEMPERATURE])).catch(this.error);
                this.setCapabilityValue('meter_temperature_waste_air', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_AIR_TEMPERATURE])).catch(this.error);
                if (this.hasCapability('meter_temperature_water'))
                    this.setCapabilityValue('meter_temperature_water', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.WATER_TEMPERATURE])).catch(this.error);
                if (this.hasCapability('meter_temperature_heat_recovery_wheel'))
                    this.setCapabilityValue('meter_temperature_heat_recovery_wheel', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.HEAT_RECOVERY_TEMPERATURE])).catch(
                        this.error
                    );
                if (this.hasCapability('meter_temperature_room'))
                    this.setCapabilityValue('meter_temperature_room', this.removeDecimal(results.inputRegisters[BaseRegisters.inputRegisters.ROOM_TEMPERATURE])).catch(this.error);
                if (this.hasCapability('meter_pressure_supply'))
                    this.setCapabilityValue('meter_pressure_supply', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.SUPPLY_PRESSURE])).catch(this.error); // TODO: Check conversion. x0.1Pa
                if (this.hasCapability('meter_pressure_extract'))
                    this.setCapabilityValue('meter_pressure_extract', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_PRESSURE])).catch(this.error); // TODO: Check conversion. x0.1Pa
                if (this.hasCapability('meter_power_supply'))
                    this.setCapabilityValue('meter_power_supply', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.SUPPLY_FAN_POWER])).catch(this.error);
                if (this.hasCapability('meter_power_extract'))
                    this.setCapabilityValue('meter_power_extract', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_FAN_POWER])).catch(this.error);
                if (this.hasCapability('meter_rpm_supply'))
                    this.setCapabilityValue('meter_rpm_supply', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.SUPPLY_FAN_SPEED])).catch(this.error);
                if (this.hasCapability('meter_rpm_extract'))
                    this.setCapabilityValue('meter_rpm_extract', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_FAN_SPEED])).catch(this.error);
                if (this.hasCapability('meter_power_heating'))
                    this.setCapabilityValue('meter_power_heating', (this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.HEATING_POWER]) / 255) * 100).catch(this.error);
                if (this.hasCapability('meter_filter_timer'))
                    this.setCapabilityValue('meter_filter_timer', this.checkNegativeNumber(results.inputRegisters[BaseRegisters.inputRegisters.FILTER_DAYS_LEFT])).catch(this.error);
            }
        // Holding registers
        if (results.holdingRegisters.length) {
            this.processRegulationMode(results.holdingRegisters[BaseRegisters.holdingRegisters.REGULATION_MODE], results.holdingRegisters[BaseRegisters.holdingRegisters.SETPOINT_TEMPERATURE]);
        }

        this.approximateMeasurePower(results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_FAN_POWER], results.inputRegisters[BaseRegisters.inputRegisters.SUPPLY_FAN_POWER], ((results.inputRegisters[BaseRegisters.inputRegisters.HEATING_POWER]) / 255) * 100);
    }

    async onSettings(event: { oldSettings: { [index: string]: any }; newSettings: { [index: string]: any }; changedKeys: string[] }): Promise<string | void> {
        this.log(`${this.getName()} settings where changed: ${event.changedKeys}`);
        this.addOrRemoveCapabilities(event.newSettings);
        if (event.changedKeys.includes('port') || event.changedKeys.includes('ip') || event.changedKeys.includes('tcp')) {
            this.api?.reconnect(event.newSettings.ip, event.newSettings.port, !!event.newSettings.tcp);
        }
        if (event.changedKeys.includes('interval') && !isNaN(event.newSettings.interval)) {
            this.api?.setPollingInterval(event.newSettings.interval);
        }
        if (event.changedKeys.some((s) => s.startsWith('alarm_invert_'))) {
            const toggledAlerts = event.changedKeys.filter((s) => s.startsWith('alarm_invert_'));
            const currentAlarms = this.getStoreValue('alarms');
            toggledAlerts.forEach((a) => {
                const k = a.replace('alarm_invert_', '');
                currentAlarms[k] = !currentAlarms[k];
            });
            await this.setStoreValue('alarms', currentAlarms);
        }
    }

    async addOrRemoveCapabilities(newSettings?: { [index: string]: any }): Promise<void> {
        const settings = newSettings ?? this.getSettings();
        Object.keys(settings).forEach((k: string) => {
            if (k.includes('capability_enabled_')) {
                const capability = k.replace('capability_enabled_', '');
                if (this.hasCapability(capability) !== settings[k]) {
                    settings[k] ? this.addCapability(capability) : this.removeCapability(capability);
                    this.log(capability, 'was', settings[k] ? 'added' : 'removed');
                }
            }
        });
    }

    removeDecimal(value: number) {
        const negativeChecked = this.checkNegativeNumber(value);
        return Math.round(negativeChecked / 10);
    }

    checkNegativeNumber(modbusValue: number) {
        const signBitMask = 0x8000;
        if ((modbusValue & signBitMask) !== 0) {
            // value is negative
            const negativeValue = (modbusValue ^ 0xffff) + 1;
            return -negativeValue;
        } else {
            // value is positive
            return modbusValue;
        }
    }

    async onDeleted() {
        this.api?.destroy();
    }
}

export default BaseDevice;
