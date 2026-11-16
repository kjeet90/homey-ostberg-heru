import Homey from 'homey';
import { HeruAPI } from './heru-api';
import { SetRegulationModeGen3, RegulationModeGen3 } from './gen-3-remote/constants';
import { SetRegulationModeIQC, RegulationModeIQC } from './iqc-touch/constants';
import { BaseRegisters } from './registers';

interface ManifestSetting {
    id?: string;
    value?: unknown;
    children?: ManifestSetting[];
}

enum FanMode {
    OFF = 'off',
    OVERPRESSURE = 'overpressure',
    BOOST = 'boost',
    NORMAL = 'normal',
    AWAY = 'away'
}

const MAX_CLOCK_DRIFT_MINUTES = 2;
const CLOCK_SYNC_RETRY_INTERVAL = 60 * 60 * 1000;

abstract class BaseDevice extends Homey.Device {
    api: HeruAPI | null = null;
    // Alarm id with the discrete input that reports it, and the alarm's name
    abstract readonly alarmInputs: { [id: string]: number };
    abstract readonly alarmNames: { [id: string]: string };
    // Operating functions shown by the unit, with the discrete input that reports whether they are active
    abstract readonly functionInputs: { [fn: string]: number };
    // Suffix of the driver's own capabilities and flow cards, like `heating_active_gen3`
    abstract readonly driverSuffix: string;
    functionStates: { [fn: string]: boolean } = {};
    lastClockSyncAttempt = 0;

    async onInit() {
        this.registerCapabilityListener('fan_mode', async (value: FanMode) => {
            await this.setFanMode(value);
            this.triggerFanModeChanged(value);
        });
        await this.addMissingSettings().catch(this.error);
        await this.addOrRemoveCapabilities().catch(this.error);
    }

    /**
     * Settings added in an app update are missing on devices that were added before, so they don't show up and the
     * capabilities they enable are never added. Fill them in with the default values from the driver manifest.
     */
    async addMissingSettings() {
        const flatten = (settings: ManifestSetting[]): ManifestSetting[] => settings.flatMap((setting) => [setting, ...flatten(setting.children ?? [])]);
        const currentSettings = this.getSettings();
        const missingSettings = Object.fromEntries(
            flatten(this.driver.manifest.settings ?? [])
                .filter(({ id, value }) => id !== undefined && value !== undefined && currentSettings[id] === undefined)
                .map(({ id, value }) => [id, value])
        );
        if (!Object.keys(missingSettings).length) return;
        await this.setSettings(missingSettings);
        this.log('Added missing settings with their default values:', Object.keys(missingSettings));
    }

    async isFanMode(value: FanMode) {
        return this.getCapabilityValue('fan_mode') === value;
    }

    abstract isRegulationMode(value: SetRegulationModeGen3 | SetRegulationModeIQC): boolean;

    async setFanMode(value: FanMode) {
        switch (value) {
            case FanMode.OFF:
                await this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [false, false, false, false]);
                break;
            case FanMode.OVERPRESSURE:
                await this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, true, false, false]);
                break;
            case FanMode.BOOST:
                await this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, false, true, false]);
                break;
            case FanMode.NORMAL:
                await this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, false, false, false]);
                break;
            case FanMode.AWAY:
                await this.api?.writeMultipleCoils(BaseRegisters.coils.UNIT_ON, [true, false, false, true]);
                break;
        }
    }

    // TODO: This seems to not work on my Gen 3 system. Investigate later. Removed .homeycompose flow actions
    // async resetAlarms() {
    //     this.api?.writeCoil(BaseRegisters.coils.CLEAR_ALARMS, true);
    // }

    // Writing 1 to this coil clears the alarms on the unit, it always reads back as 0. Alarms whose cause is still present come back.
    async clearAlarms() {
        await this.api?.writeCoil(BaseRegisters.coils.CLEAR_ALARMS, true);
        this.log('Alarms cleared');
    }

    // Writing 1 to this coil resets the filter timer, it always reads back as 0
    async resetFilterTimer() {
        await this.api?.writeCoil(BaseRegisters.coils.RESET_FILTER_TIMER, true);
        this.log('Filter timer reset');
    }

    abstract setRegulationMode(value: SetRegulationModeGen3 | SetRegulationModeIQC): Promise<void>;

    abstract triggerRegulationModeChanged(value: SetRegulationModeGen3 | SetRegulationModeIQC): void;

    abstract processRegulationMode(regulationMode: RegulationModeGen3 | RegulationModeIQC, targetTemperature: number): void;

    triggerFanModeChanged(value: FanMode) {
        this.homey.flow.getDeviceTriggerCard('fan_mode_changed').trigger(this, { mode: value.charAt(0).toUpperCase() + value.slice(1) }).catch(this.error);
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

    listActiveAlarms() {
        return {
            allActive: this.getActiveAlarmsString(this.getStoreValue('alarms'), this.alarmNames)
        };
    }

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

    async processAlarms(discreteInputs: boolean[]): Promise<void> {
        const previousAlarms: { [index: string]: boolean } = this.getStoreValue('alarms') || {};
        const currentAlarms = Object.fromEntries(Object.entries(this.alarmInputs).map(([id, input]) => [id, discreteInputs[input]]));
        const activeAlarms = await this.checkAlarmTriggers(currentAlarms, previousAlarms, this.alarmNames);
        if (this.hasCapability('alarm_active_alarms')) {
            this.setCapabilityValue('alarm_active_alarms', !!activeAlarms.length).catch(this.error);
        }
    }

    isFunctionActive(fn: string) {
        return !!this.functionStates[fn];
    }

    processFunctions(discreteInputs: boolean[]) {
        Object.entries(this.functionInputs).forEach(([fn, input]) => {
            const active = !!discreteInputs[input];
            const previous = this.functionStates[fn];
            this.functionStates[fn] = active;
            const capability = `${fn}_active_${this.driverSuffix}`;
            if (this.hasCapability(capability)) this.setCapabilityValue(capability, active).catch(this.error);
            // Don't trigger on the first read after starting, when the previous state is unknown
            if (previous !== undefined && previous !== active) {
                this.homey.flow.getDeviceTriggerCard(`function_${active ? 'started' : 'stopped'}_${this.driverSuffix}`).trigger(this, {}, { function: fn }).catch(this.error);
            }
        });
    }

    // Sets an enum sensor and fires its trigger when the value changes, but not on the first read when the previous value is unknown
    updateEnumSensor(capability: string, value: number, triggerId: string, tokens: object) {
        const previous = this.getCapabilityValue(capability);
        const id = value.toString(10);
        this.setCapabilityValue(capability, id).catch(this.error);
        if (previous !== null && previous !== id) {
            this.homey.flow.getDeviceTriggerCard(triggerId).trigger(this, tokens).catch(this.error);
        }
    }

    abstract syncClock(): Promise<void>;

    // The schedules run on the unit's clock. When enabled, correct it once it is a few minutes off, and wait before retrying a sync that didn't help.
    syncClockIfDrifted(driftMinutes: number) {
        if (!this.getSetting('sync_clock') || Date.now() - this.lastClockSyncAttempt < CLOCK_SYNC_RETRY_INTERVAL) return;
        if (driftMinutes > MAX_CLOCK_DRIFT_MINUTES) {
            this.log(`The unit's clock is ${driftMinutes} minutes off, setting it to Homey's time`);
            this.syncClock().catch(this.error);
        }
    }

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
            if (this.hasCapability('meter_power')) this.setCapabilityValue('meter_power', this.getCapabilityValue('meter_power') + energyKWh).catch(this.error);
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

        // Inputs Registers
        if (results.inputRegisters.length) {
            this.setCapabilityValue('meter_temperature_outdoor_air', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.OUTDOOR_TEMPERATURE])).catch(this.error);
            this.setCapabilityValue('meter_temperature_supply_air', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.SUPPLY_AIR_TEMPERATURE])).catch(this.error);
            this.setCapabilityValue('meter_temperature_extract_air', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.EXTRACT_AIR_TEMPERATURE])).catch(this.error);
            this.setCapabilityValue('meter_temperature_waste_air', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_AIR_TEMPERATURE])).catch(this.error);
            this.setCapabilityValue('meter_thermal_efficiency', this.calculateThermalEfficiency(
                results.inputRegisters[BaseRegisters.inputRegisters.OUTDOOR_TEMPERATURE],
                results.inputRegisters[BaseRegisters.inputRegisters.HEAT_RECOVERY_TEMPERATURE],
                results.inputRegisters[BaseRegisters.inputRegisters.EXTRACT_AIR_TEMPERATURE],
                results.inputRegisters[BaseRegisters.inputRegisters.EXHAUST_AIR_TEMPERATURE],
            )).catch(this.error);
            if (this.hasCapability('meter_temperature_water'))
                this.setCapabilityValue('meter_temperature_water', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.WATER_TEMPERATURE])).catch(this.error);
            if (this.hasCapability('meter_temperature_heat_recovery_wheel'))
                this.setCapabilityValue('meter_temperature_heat_recovery_wheel', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.HEAT_RECOVERY_TEMPERATURE])).catch(
                    this.error
                );
            if (this.hasCapability('meter_temperature_room'))
                this.setCapabilityValue('meter_temperature_room', this.roundToOneDecimal(results.inputRegisters[BaseRegisters.inputRegisters.ROOM_TEMPERATURE])).catch(this.error);
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
        await this.addOrRemoveCapabilities(event.newSettings);
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
        const changes = Object.keys(settings)
            .filter((k) => k.includes('capability_enabled_'))
            .map((k) => [k.replace('capability_enabled_', ''), !!settings[k]] as const)
            .filter(([capability, enabled]) => this.hasCapability(capability) !== enabled)
            .map(async ([capability, enabled]) => {
                await (enabled ? this.addCapability(capability) : this.removeCapability(capability));
                this.log(capability, 'was', enabled ? 'added' : 'removed');
            });
        await Promise.all(changes);
    }

    roundToOneDecimal(value: number) {
        const negativeChecked = this.checkNegativeNumber(value);
        return negativeChecked / 10;
    }

    calculateThermalEfficiency(outDoorTemp: number, supplyTemp: number, extractTemp: number, exhaustTemp: number) {
        const negativeCheckedOutDoorTemp = this.checkNegativeNumber(outDoorTemp);
        const negativeCheckedSupplyTemp = this.checkNegativeNumber(supplyTemp);
        const negativeCheckedExtractTemp = this.checkNegativeNumber(extractTemp);
        const negativeCheckedExhaustTemp = this.checkNegativeNumber(exhaustTemp);
        const isPHI = this.getSetting('use_phi_algorithm_for_thermal_efficiency');

        return isPHI
            ? ((negativeCheckedExtractTemp - negativeCheckedExhaustTemp)/(negativeCheckedExtractTemp - negativeCheckedOutDoorTemp))*100
            : ((negativeCheckedSupplyTemp - negativeCheckedOutDoorTemp)/(negativeCheckedExtractTemp - negativeCheckedOutDoorTemp))*100;
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
