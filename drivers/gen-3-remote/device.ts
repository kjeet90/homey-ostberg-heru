import BaseDevice from '../base-device';
import { HeruAPI } from '../heru-api';
import { Gen3HoldingRegisters, Gen3Registers } from '../registers';
import { alarms, gen3AlarmInputs, functionInputs, registers, RegulationModeGen3, SetRegulationModeGen3 } from './constants';
import { getLocalTime, isWeekdayInMask, pad, WEEKDAY_NAMES, WEEKDAYS, weekdaysToMask } from '../utils';

const FAN_SPEED_NAMES = ['Off', 'Min', 'Standard', 'Medium', 'Max'];
const MINUTES_PER_WEEK = 7 * 24 * 60;

export class Gen3Remote extends BaseDevice {
    readonly alarmInputs = gen3AlarmInputs;
    readonly alarmNames = alarms;
    readonly functionInputs = functionInputs;
    readonly driverSuffix = 'gen3';

    async onInit() {
        await super.onInit();
        await this.upgradeExistingDevice();
        this.api = new HeruAPI(this, registers, this.getSetting('interval') || 2000);
        this.log(`${this.getName()} has been initialized`);

        this.registerCapabilityListener('regulation_mode_gen3', async (value: SetRegulationModeGen3) => {
            await this.setRegulationMode(value);
            this.triggerRegulationModeChanged(value);
        });

        this.registerCapabilityListener('target_temperature', async (value) => {
            await this.setTargetTemperature(value);
        });

        this.registerCapabilityListener('heater_enabled_gen3', async (value) => {
            await this.setHeaterEnabled(value);
        });

        this.registerCapabilityListener('week_timer_enabled_gen3', async (value) => {
            await this.setWeekTimerEnabled(value);
        });
        this.registerCapabilityListener('summer_night_cooling_enabled', async (value) => {
            await this.setSummerNightCoolingEnabled(value);
        });
        this.registerCapabilityListener('button.reset_filter_timer', async () => {
            await this.resetFilterTimer();
        });
        this.registerCapabilityListener('button.clear_alarms', async () => {
            await this.clearAlarms();
        });
    }

    async upgradeExistingDevice() {
        if (!this.hasCapability('heater_enabled_gen3')) await this.addCapability('heater_enabled_gen3');
        if (!this.hasCapability('week_timer_enabled_gen3')) await this.addCapability('week_timer_enabled_gen3');
        if (!this.hasCapability('week_timer_current_active_program_gen3')) await this.addCapability('week_timer_current_active_program_gen3');
        if (!this.hasCapability('summer_night_cooling_enabled')) await this.addCapability('summer_night_cooling_enabled');
        if (!this.hasCapability('meter_thermal_efficiency')) await this.addCapability('meter_thermal_efficiency');
        if (!this.hasCapability('current_fan_speed_gen3')) await this.addCapability('current_fan_speed_gen3');
        if (!this.hasCapability('heating_active_gen3')) await this.addCapability('heating_active_gen3');
        if (!this.hasCapability('heat_recovery_active_gen3')) await this.addCapability('heat_recovery_active_gen3');
        if (!this.hasCapability('button.reset_filter_timer')) await this.addCapability('button.reset_filter_timer');
        if (!this.hasCapability('button.clear_alarms')) await this.addCapability('button.clear_alarms');
    }

    isCurrentFanSpeed(speed: string) {
        return this.getCapabilityValue('current_fan_speed_gen3') === speed;
    }

    isWeekTimerProgramActive(program: string) {
        return this.getCapabilityValue('week_timer_current_active_program_gen3') === program;
    }

    async syncClock() {
        this.lastClockSyncAttempt = Date.now();
        const { weekday, hours, minutes, seconds } = getLocalTime(this.homey.clock.getTimezone());
        // One request, so the seconds are written last and the unit applies the new time in one go
        await this.api?.writeRegisters(Gen3Registers.holdingRegisters.CLOCK_WEEKDAY, [weekday, hours, minutes, seconds]);
        this.log(`Set the unit's clock to ${WEEKDAY_NAMES[weekday]} ${hours}:${pad(minutes)}:${pad(seconds)}`);
    }

    // The unit's clock only has a weekday, so compare the minutes into the week
    checkClockDrift(holdingRegisters: number[]) {
        const homey = getLocalTime(this.homey.clock.getTimezone());
        const unitMinutes = holdingRegisters[Gen3Registers.holdingRegisters.CLOCK_WEEKDAY] * 1440 + holdingRegisters[Gen3Registers.holdingRegisters.CLOCK_HOURS] * 60 + holdingRegisters[Gen3Registers.holdingRegisters.CLOCK_MINUTES];
        const homeyMinutes = homey.weekday * 1440 + homey.hours * 60 + homey.minutes;
        const difference = Math.abs(unitMinutes - homeyMinutes);
        this.syncClockIfDrifted(Math.min(difference, MINUTES_PER_WEEK - difference));
    }

    processCurrentFanSpeed(speed: number) {
        this.updateEnumSensor('current_fan_speed_gen3', speed, 'current_fan_speed_changed_gen3', { speed: FAN_SPEED_NAMES[speed] ?? speed.toString(10) });
    }

    processWeekTimerProgram(program: number) {
        this.updateEnumSensor('week_timer_current_active_program_gen3', program, 'week_timer_program_changed_gen3', { program });
    }

    async setHeaterEnabled(value: boolean) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters.HEATER_ENABLED, value ? 1 : 0);
    }

    async setSummerNightCoolingEnabled(value: boolean) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters.SUMMER_NIGHT_COOLING_ENABLED, value ? 1 : 0);
    }

    async setWeekTimerEnabled(value: boolean) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters.WEEK_TIMER_ENABLED, value ? 1 : 0);
    }

    async updateWeekProgramWeekdays(program: number, weekdays: number) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_WEEKDAYS` as keyof typeof Gen3HoldingRegisters], weekdays);
    }

    // Changes one weekday of a program, keeping the other days as they are
    async updateWeekProgramWeekday(program: number, weekday: string, value: boolean) {
        const settings = this.getSettings();
        await this.updateWeekProgramWeekdays(program, weekdaysToMask((day) => (day === weekday ? value : !!settings[`program_${program}_week_day_${day}`])));
    }

    async updateWeekProgramStartTime(program: number, hour: number, minute: number) {
        await Promise.all([
            this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_START_HOUR` as keyof typeof Gen3HoldingRegisters], hour),
            this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_START_MINUTE` as keyof typeof Gen3HoldingRegisters], minute)
        ]);
    }

    async updateWeekProgramEndTime(program: number, hour: number, minute: number) {
        await Promise.all([
            this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_END_HOUR` as keyof typeof Gen3HoldingRegisters], hour),
            this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_END_MINUTE` as keyof typeof Gen3HoldingRegisters], minute)
        ]);
    }

    async updateWeekProgramTemperature(program: number, temperature: number) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_TEMPERATURE` as keyof typeof Gen3HoldingRegisters], temperature);
    }

    async updateWeekProgramFanSpeed(program: number, fanSpeed: number) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_FAN_SPEED` as keyof typeof Gen3HoldingRegisters], fanSpeed);
    }

    async setTargetTemperature(target: number) {
        await this.api?.writeRegister(Gen3Registers.holdingRegisters.SETPOINT_TEMPERATURE, target);
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
        this.homey.flow.getDeviceTriggerCard('regulation_mode_changed_gen3').trigger(this, { mode }).catch(this.error);
    }

    isRegulationMode(value: SetRegulationModeGen3) {
        return this.getCapabilityValue('regulation_mode_gen3') === value;
    }

    async setRegulationMode(value: SetRegulationModeGen3) {
        switch (value) {
            case SetRegulationModeGen3.SUPPLY:
                await this.api?.writeRegister(Gen3Registers.holdingRegisters.REGULATION_MODE, RegulationModeGen3.SUPPLY);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                break;
            case SetRegulationModeGen3.EXTRACT:
                await this.api?.writeRegister(Gen3Registers.holdingRegisters.REGULATION_MODE, RegulationModeGen3.EXTRACT);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case SetRegulationModeGen3.ROOM:
                await this.api?.writeRegister(Gen3Registers.holdingRegisters.REGULATION_MODE, RegulationModeGen3.ROOM);
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

    async onSettings(event: {
        oldSettings: { [p: string]: any };
        newSettings: { [p: string]: any };
        changedKeys: string[]
    }): Promise<string | void> {
        await super.onSettings(event);

        const { changedKeys, newSettings } = event;

        // Wait for the unit to accept the new values, so a failed write shows an error and the settings are not saved
        const writes = [1, 2, 3, 4, 5].flatMap((program) => {
            const prefix = `program_${program}`;
            const setting = (key: string) => newSettings[`${prefix}_${key}`];
            const updates: [string, () => Promise<void>][] = [
                ['week_day', () => this.updateWeekProgramWeekdays(program, weekdaysToMask((day) => !!setting(`week_day_${day}`)))],
                ['start', () => this.updateWeekProgramStartTime(program, setting('start_hour'), setting('start_minute'))],
                ['end', () => this.updateWeekProgramEndTime(program, setting('end_hour'), setting('end_minute'))],
                ['temperature', () => this.updateWeekProgramTemperature(program, setting('temperature'))],
                ['fan_speed', () => this.updateWeekProgramFanSpeed(program, setting('fan_speed'))]
            ];

            return updates
                .filter(([key]) => changedKeys.some((changedKey) => changedKey.includes(`${prefix}_${key}`)))
                .map(([, update]) => update());
        });
        await Promise.all(writes);
    }

    processResults(results: { coils: boolean[]; discreteInputs: boolean[]; inputRegisters: number[]; holdingRegisters: number[] }): void {
        super.processResults(results);

        // Discrete inputs
        if (results.discreteInputs.length) {
            this.processFunctions(results.discreteInputs);
        }

        // Inputs Registers
        if (results.inputRegisters.length) {
            if (this.hasCapability('measure_co2')) {
                this.setCapabilityValue('measure_co2', results.inputRegisters[Gen3Registers.inputRegisters.CARBON_DIOXIDE]).catch(this.error);
            }
            if (this.hasCapability('meter_humidity_relative')) {
                this.setCapabilityValue('meter_humidity_relative', this.roundToOneDecimal(results.inputRegisters[Gen3Registers.inputRegisters.RELATIVE_HUMIDITY])).catch(this.error);
            }
            if (this.hasCapability('meter_power_heat_recovery')) {
                this.setCapabilityValue('meter_power_heat_recovery', (this.checkNegativeNumber(results.inputRegisters[Gen3Registers.inputRegisters.HEAT_COLR_RECOVERY_POWER]) / 255) * 100).catch(this.error);
            }
            this.processWeekTimerProgram(results.inputRegisters[Gen3Registers.inputRegisters.WEEK_TIMER_CURRENT_ACTIVE_PROGRAM]);
            this.processCurrentFanSpeed(results.inputRegisters[Gen3Registers.inputRegisters.CURRENT_FAN_SPEED]);
        }

        // Holding Registers
        if (results.holdingRegisters.length) {
            const programSettings = Array.from({ length: 5 }).map((_, i) => {
                const program = i + 1;
                const weekdays = results.holdingRegisters[Gen3Registers.holdingRegisters[`WEEK_TIMER_PROGRAM_${program}_WEEKDAYS` as keyof typeof Gen3HoldingRegisters]];

                return {
                    ...Object.fromEntries(WEEKDAYS.map((day) => [`program_${program}_week_day_${day}`, isWeekdayInMask(weekdays, day)])),
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

            const currentSettings = this.getSettings();
            const programSettingsChanged = Object.keys(programSettings).some((k) => currentSettings[k] !== programSettings[k]);
            if (programSettingsChanged) this.setSettings(programSettings).catch(this.error);

            this.setCapabilityValue('heater_enabled_gen3', !!results.holdingRegisters[Gen3Registers.holdingRegisters.HEATER_ENABLED]).catch(this.error);
            this.setCapabilityValue('summer_night_cooling_enabled', !!results.holdingRegisters[Gen3Registers.holdingRegisters.SUMMER_NIGHT_COOLING_ENABLED]).catch(this.error);
            this.setCapabilityValue('week_timer_enabled_gen3', !!results.holdingRegisters[Gen3Registers.holdingRegisters.WEEK_TIMER_ENABLED]).catch(this.error);

            this.checkClockDrift(results.holdingRegisters);
        }

    }
}

module.exports = Gen3Remote;
