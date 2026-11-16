import BaseDevice from '../base-device';
import { HeruAPI } from '../heru-api';
import { IQCRegisters, IQCHoldingRegisters, IQCWeekProgramField as WeekField, IQCHolidayProgramField as HolidayField, iqcWeekProgramRegister, iqcHolidayProgramRegister } from '../registers';
import { alarms, alarmInputs, functionInputs, registers, SetRegulationModeIQC, RegulationModeIQC, WEEK_PROGRAMS, HOLIDAY_PROGRAMS, QualitySensorTypeIQC } from './constants';
import { formatIsoDate, fromUnitDate, getLocalTime, isWeekdayInMask, pad, parseIsoDate, toUnitDate, WEEKDAYS, weekdaysToMask } from '../utils';

const QUALITY_SENSORS = [
    [IQCRegisters.inputRegisters.QUALITY_SENSOR_1_TYPE, IQCRegisters.inputRegisters.QUALITY_SENSOR_1_VALUE],
    [IQCRegisters.inputRegisters.QUALITY_SENSOR_2_TYPE, IQCRegisters.inputRegisters.QUALITY_SENSOR_2_VALUE],
    [IQCRegisters.inputRegisters.QUALITY_SENSOR_3_TYPE, IQCRegisters.inputRegisters.QUALITY_SENSOR_3_VALUE]
];

const FAN_SPEED_NAMES = ['Off', 'Min', 'Standard', 'Max'];
// Values of the program fan speed and temperature mode settings, as written to the unit
const PROGRAM_FAN_SPEEDS = ['0', '1', '2', '3'];
const PROGRAM_TEMPERATURE_MODES = ['0', '1'];

// The settings show a date as YYYY-MM-DD, and empty when the unit has no valid date
function formatUnitDate(year: number, monthDay: number) {
    const date = fromUnitDate(year, monthDay);
    return date ? formatIsoDate(date) : '';
}

// Program numbers from 1 to count
const programs = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

type SettingEntry = [string, string | number | boolean];

// Leave out values the unit doesn't know, the setting would refuse them
const dropdownSetting = (key: string, value: number, allowed: string[]): SettingEntry[] => (allowed.includes(String(value)) ? [[key, String(value)]] : []);

// The settings of a week schedule program, as the unit has them
function weekProgramSettings(program: number, holdingRegisters: number[]): SettingEntry[] {
    const prefix = `week_program_${program}`;
    const value = (field: WeekField) => holdingRegisters[iqcWeekProgramRegister(program, field)];
    return [
        ...WEEKDAYS.map((day): SettingEntry => [`${prefix}_week_day_${day}`, isWeekdayInMask(value(WeekField.WEEKDAYS), day)]),
        [`${prefix}_enabled`, !!value(WeekField.ENABLED)],
        [`${prefix}_start_hour`, value(WeekField.START_HOUR)],
        [`${prefix}_start_minute`, value(WeekField.START_MINUTE)],
        [`${prefix}_end_hour`, value(WeekField.END_HOUR)],
        [`${prefix}_end_minute`, value(WeekField.END_MINUTE)],
        ...dropdownSetting(`${prefix}_temperature_mode`, value(WeekField.TEMPERATURE_MODE), PROGRAM_TEMPERATURE_MODES),
        ...dropdownSetting(`${prefix}_fan_speed`, value(WeekField.FAN_SPEED), PROGRAM_FAN_SPEEDS)
    ];
}

// The settings of a holiday schedule program, as the unit has them
function holidayProgramSettings(program: number, holdingRegisters: number[]): SettingEntry[] {
    const prefix = `holiday_program_${program}`;
    const value = (field: HolidayField) => holdingRegisters[iqcHolidayProgramRegister(program, field)];
    return [
        // Only bit 0 is the on/off state
        [`${prefix}_enabled`, !!(value(HolidayField.ENABLED) & 1)],
        [`${prefix}_start_date`, formatUnitDate(value(HolidayField.START_YEAR), value(HolidayField.START_DATE))],
        [`${prefix}_start_hour`, value(HolidayField.START_HOUR)],
        [`${prefix}_start_minute`, value(HolidayField.START_MINUTE)],
        [`${prefix}_end_date`, formatUnitDate(value(HolidayField.END_YEAR), value(HolidayField.END_DATE))],
        [`${prefix}_end_hour`, value(HolidayField.END_HOUR)],
        [`${prefix}_end_minute`, value(HolidayField.END_MINUTE)],
        ...dropdownSetting(`${prefix}_temperature_mode`, value(HolidayField.TEMPERATURE_MODE), PROGRAM_TEMPERATURE_MODES),
        ...dropdownSetting(`${prefix}_fan_speed`, value(HolidayField.FAN_SPEED), PROGRAM_FAN_SPEEDS)
    ];
}

// A holiday program's start or end as one comparable number
function holidayTime(date: Date, hour: number, minute: number) {
    return date.getTime() + (hour * 60 + minute) * 60000;
}

class IQCTouch extends BaseDevice {
    readonly alarmInputs = alarmInputs;
    readonly alarmNames = alarms;
    readonly functionInputs = functionInputs;
    readonly driverSuffix = 'iqc';
    // Last holding registers read from the unit, to change a single bit without touching the others
    holdingRegisters: number[] = [];

    async onInit() {
        await super.onInit();
        await this.upgradeExistingDevice();

        this.api = new HeruAPI(this, registers, this.getSetting('interval') ?? 2000);
        this.log(`${this.getName()} has been initialized`);
        this.registerCapabilityListener('regulation_mode_iqc', async (value: SetRegulationModeIQC) => {
            await this.setRegulationMode(value);
            this.triggerRegulationModeChanged(value);
        });
        this.registerCapabilityListener('target_temperature', async (value) => {
            await this.setTargetTemperature(value, false);
        });
        this.registerCapabilityListener('target_temperature.eco', async (value) => {
            await this.setTargetTemperature(value, true);
        });
        this.registerCapabilityListener('heater_enabled_iqc', async (value) => {
            await this.setHeaterEnabled(value);
        });
        this.registerCapabilityListener('preheater_enabled_iqc', async (value) => {
            await this.setPreheaterEnabled(value);
        });
        this.registerCapabilityListener('summer_night_cooling_enabled', async (value) => {
            await this.setSummerNightCoolingEnabled(value);
        });
        this.registerCapabilityListener('week_schedule_enabled_iqc', async (value) => {
            await this.setWeekScheduleEnabled(value);
        });
        this.registerCapabilityListener('holiday_schedule_enabled_iqc', async (value) => {
            await this.setHolidayScheduleEnabled(value);
        });
        this.registerCapabilityListener('button.reset_filter_timer', async () => {
            await this.resetFilterTimer();
        });
        this.registerCapabilityListener('button.clear_alarms', async () => {
            await this.clearAlarms();
        });
    }

    async upgradeExistingDevice() {
        if (!this.hasCapability('preheater_enabled_iqc')) await this.addCapability('preheater_enabled_iqc');
        if (!this.hasCapability('heater_enabled_iqc')) await this.addCapability('heater_enabled_iqc');
        if (!this.hasCapability('summer_night_cooling_enabled')) await this.addCapability('summer_night_cooling_enabled');
        if (!this.hasCapability('meter_thermal_efficiency')) await this.addCapability('meter_thermal_efficiency');
        if (!this.hasCapability('current_fan_speed_iqc')) await this.addCapability('current_fan_speed_iqc');
        if (!this.hasCapability('heating_active_iqc')) await this.addCapability('heating_active_iqc');
        if (!this.hasCapability('heat_recovery_active_iqc')) await this.addCapability('heat_recovery_active_iqc');
        if (!this.hasCapability('week_schedule_enabled_iqc')) await this.addCapability('week_schedule_enabled_iqc');
        if (!this.hasCapability('week_schedule_active_program_iqc')) await this.addCapability('week_schedule_active_program_iqc');
        if (!this.hasCapability('holiday_schedule_enabled_iqc')) await this.addCapability('holiday_schedule_enabled_iqc');
        if (!this.hasCapability('button.reset_filter_timer')) await this.addCapability('button.reset_filter_timer');
        if (!this.hasCapability('button.clear_alarms')) await this.addCapability('button.clear_alarms');
    }

    isCurrentFanSpeed(speed: string) {
        return this.getCapabilityValue('current_fan_speed_iqc') === speed;
    }

    isWeekProgramActive(program: string) {
        return this.getCapabilityValue('week_schedule_active_program_iqc') === program;
    }

    // ########## Clock ##########

    async syncClock() {
        this.lastClockSyncAttempt = Date.now();
        const { year, month, day, hours, minutes, seconds } = getLocalTime(this.homey.clock.getTimezone());
        // One request, so the seconds are written last and the unit applies the new time in one go
        await this.api?.writeRegisters(IQCHoldingRegisters.CLOCK_YEAR, [year, month, day, hours, minutes, seconds]);
        this.log(`Set the unit's clock to ${year}-${pad(month)}-${pad(day)} ${hours}:${pad(minutes)}:${pad(seconds)}`);
    }

    checkClockDrift(holdingRegisters: number[]) {
        const clock = [
            IQCHoldingRegisters.CLOCK_YEAR,
            IQCHoldingRegisters.CLOCK_MONTH,
            IQCHoldingRegisters.CLOCK_DAY,
            IQCHoldingRegisters.CLOCK_HOURS,
            IQCHoldingRegisters.CLOCK_MINUTES
        ].map((register) => holdingRegisters[register]);
        // The clock registers could not be read
        if (clock.some((value) => value === undefined)) return;
        const [year, month, day, hours, minutes] = clock;
        const homey = getLocalTime(this.homey.clock.getTimezone());
        const unitTime = Date.UTC(year, month - 1, day, hours, minutes);
        const homeyTime = Date.UTC(homey.year, homey.month - 1, homey.day, homey.hours, homey.minutes);
        this.syncClockIfDrifted(Math.round(Math.abs(unitTime - homeyTime) / 60000));
    }

    // ########## Status ##########

    processCurrentFanSpeed(speed: number) {
        this.updateEnumSensor('current_fan_speed_iqc', speed, 'current_fan_speed_changed_iqc', { speed: FAN_SPEED_NAMES[speed] ?? speed.toString(10) });
    }

    processWeekProgram(program: number) {
        this.updateEnumSensor('week_schedule_active_program_iqc', program, 'week_schedule_program_changed_iqc', { program });
    }

    // Each quality sensor input can have a humidity, CO2 or VOC sensor. When there are more of the same type, the unit uses the highest value.
    processQualitySensors(inputRegisters: number[]) {
        const values: Partial<Record<QualitySensorTypeIQC, number>> = {};
        QUALITY_SENSORS.forEach(([typeRegister, valueRegister]) => {
            const type = inputRegisters[typeRegister] as QualitySensorTypeIQC | undefined;
            if (type === undefined || type === QualitySensorTypeIQC.NONE) return;
            const value = this.checkNegativeNumber(inputRegisters[valueRegister]);
            values[type] = Math.max(values[type] ?? value, value);
        });
        const humidity = values[QualitySensorTypeIQC.RH];
        const co2 = values[QualitySensorTypeIQC.CO2];
        if (humidity !== undefined && this.hasCapability('meter_humidity_relative')) this.setCapabilityValue('meter_humidity_relative', humidity).catch(this.error);
        if (co2 !== undefined && this.hasCapability('measure_co2')) this.setCapabilityValue('measure_co2', co2).catch(this.error);
    }

    // ########## Settings ##########

    async setTargetTemperature(target: number, eco: boolean) {
        if (eco) await this.api?.writeRegister(IQCRegisters.holdingRegisters.SETPOINT_TEMPERATURE_ECONOMY, target);
        else await this.api?.writeRegister(IQCRegisters.holdingRegisters.SETPOINT_TEMPERATURE, target);
    }

    async setHeaterEnabled(value: boolean) {
        await this.api?.writeRegister(IQCRegisters.holdingRegisters.HEATER_ENABLED, value ? 1 : 0);
    }

    async setPreheaterEnabled(value: boolean) {
        await this.api?.writeRegister(IQCRegisters.holdingRegisters.PREHEATER_ENABLED, value ? 1 : 0);
    }

    async setSummerNightCoolingEnabled(value: boolean) {
        await this.api?.writeRegister(IQCRegisters.holdingRegisters.SUMMER_NIGHT_COOLING_ENABLED, value ? 1 : 0);
    }

    // ########## Week schedule ##########

    async setWeekScheduleEnabled(value: boolean) {
        await this.api?.writeRegister(IQCHoldingRegisters.WEEK_SCHEDULE_ENABLED, value ? 1 : 0);
    }

    async setWeekProgramEnabled(program: number, value: boolean) {
        await this.api?.writeRegister(iqcWeekProgramRegister(program, WeekField.ENABLED), value ? 1 : 0);
    }

    async setWeekProgramWeekdays(program: number, weekdays: number) {
        await this.api?.writeRegister(iqcWeekProgramRegister(program, WeekField.WEEKDAYS), weekdays);
    }

    // Changes one weekday of a program, keeping the other days as they are
    async setWeekProgramWeekday(program: number, weekday: string, value: boolean) {
        const settings = this.getSettings();
        await this.setWeekProgramWeekdays(program, weekdaysToMask((day) => (day === weekday ? value : !!settings[`week_program_${program}_week_day_${day}`])));
    }

    async setWeekProgramStartTime(program: number, hour: number, minute: number) {
        await this.api?.writeRegisters(iqcWeekProgramRegister(program, WeekField.START_HOUR), [hour, minute]);
    }

    async setWeekProgramEndTime(program: number, hour: number, minute: number) {
        await this.api?.writeRegisters(iqcWeekProgramRegister(program, WeekField.END_HOUR), [hour, minute]);
    }

    async setWeekProgramFanSpeed(program: number, fanSpeed: number) {
        await this.api?.writeRegister(iqcWeekProgramRegister(program, WeekField.FAN_SPEED), fanSpeed);
    }

    async setWeekProgramTemperatureMode(program: number, mode: number) {
        await this.api?.writeRegister(iqcWeekProgramRegister(program, WeekField.TEMPERATURE_MODE), mode);
    }

    // ########## Holiday schedule ##########

    async setHolidayScheduleEnabled(value: boolean) {
        await this.api?.writeRegister(IQCHoldingRegisters.HOLIDAY_SCHEDULE_ENABLED, value ? 1 : 0);
    }

    async setHolidayProgramEnabled(program: number, value: boolean) {
        const register = iqcHolidayProgramRegister(program, HolidayField.ENABLED);
        // Only bit 0 is the on/off state, so keep the other bits as the unit has them
        const current = this.holdingRegisters[register] ?? 0;
        await this.api?.writeRegister(register, value ? current | 1 : current & ~1);
    }

    async setHolidayProgramStart(program: number, date: string, hour: number, minute: number) {
        const { year, monthDay } = toUnitDate(this.parseHolidayDate(program, 'start', date));
        await this.api?.writeRegisters(iqcHolidayProgramRegister(program, HolidayField.START_YEAR), [year, monthDay, hour, minute]);
    }

    async setHolidayProgramEnd(program: number, date: string, hour: number, minute: number) {
        const { year, monthDay } = toUnitDate(this.parseHolidayDate(program, 'end', date));
        await this.api?.writeRegisters(iqcHolidayProgramRegister(program, HolidayField.END_YEAR), [year, monthDay, hour, minute]);
    }

    async setHolidayProgramFanSpeed(program: number, fanSpeed: number) {
        await this.api?.writeRegister(iqcHolidayProgramRegister(program, HolidayField.FAN_SPEED), fanSpeed);
    }

    async setHolidayProgramTemperatureMode(program: number, mode: number) {
        await this.api?.writeRegister(iqcHolidayProgramRegister(program, HolidayField.TEMPERATURE_MODE), mode);
    }

    parseHolidayDate(program: number, which: 'start' | 'end', date: unknown) {
        const parsed = parseIsoDate(date);
        if (!parsed) throw new Error(`Holiday program ${program}: enter the ${which} date as YYYY-MM-DD, for example 2026-12-24`);
        return parsed;
    }

    // The unit's schedules are shown as device settings, so they follow changes made on the panel or by flows
    processSchedules(holdingRegisters: number[]) {
        const weekScheduleEnabled = holdingRegisters[IQCHoldingRegisters.WEEK_SCHEDULE_ENABLED];
        const holidayScheduleEnabled = holdingRegisters[IQCHoldingRegisters.HOLIDAY_SCHEDULE_ENABLED];
        if (weekScheduleEnabled !== undefined) this.setCapabilityValue('week_schedule_enabled_iqc', !!weekScheduleEnabled).catch(this.error);
        if (holidayScheduleEnabled !== undefined) this.setCapabilityValue('holiday_schedule_enabled_iqc', !!holidayScheduleEnabled).catch(this.error);

        const weekSettings = weekScheduleEnabled === undefined ? [] : programs(WEEK_PROGRAMS).flatMap((program) => weekProgramSettings(program, holdingRegisters));
        const holidaySettings = programs(HOLIDAY_PROGRAMS)
            // Programs 6-10 are read separately, so either half can be missing
            .filter((program) => holdingRegisters[iqcHolidayProgramRegister(program, HolidayField.START_YEAR)] !== undefined)
            .flatMap((program) => holidayProgramSettings(program, holdingRegisters));

        const currentSettings = this.getSettings();
        const changed = Object.fromEntries([...weekSettings, ...holidaySettings].filter(([key, value]) => currentSettings[key] !== value));
        if (Object.keys(changed).length) this.setSettings(changed).catch(this.error);
    }

    async onSettings(event: { oldSettings: { [index: string]: any }; newSettings: { [index: string]: any }; changedKeys: string[] }): Promise<string | void> {
        const { changedKeys, newSettings } = event;
        const isChanged = (prefix: string, key: string) => changedKeys.some((changedKey) => changedKey.startsWith(`${prefix}_${key}`));
        // The updates whose settings changed, not run yet
        const changedUpdates = (prefix: string, updates: [string, () => Promise<void>][]) => updates.filter(([key]) => isChanged(prefix, key)).map(([, update]) => update);

        // Check the dates before anything is written, so a typo shows an error and nothing is saved
        programs(HOLIDAY_PROGRAMS)
            .filter((program) => isChanged(`holiday_program_${program}`, 'start_') || isChanged(`holiday_program_${program}`, 'end_'))
            .forEach((program) => this.validateHolidayProgram(program, (key) => newSettings[`holiday_program_${program}_${key}`]));

        const weekUpdates = programs(WEEK_PROGRAMS).flatMap((program) => {
            const prefix = `week_program_${program}`;
            const setting = (key: string) => newSettings[`${prefix}_${key}`];
            return changedUpdates(prefix, [
                ['week_day_', () => this.setWeekProgramWeekdays(program, weekdaysToMask((day) => !!setting(`week_day_${day}`)))],
                ['start_', () => this.setWeekProgramStartTime(program, setting('start_hour'), setting('start_minute'))],
                ['end_', () => this.setWeekProgramEndTime(program, setting('end_hour'), setting('end_minute'))],
                ['temperature_mode', () => this.setWeekProgramTemperatureMode(program, Number(setting('temperature_mode')))],
                ['fan_speed', () => this.setWeekProgramFanSpeed(program, Number(setting('fan_speed')))],
                ['enabled', () => this.setWeekProgramEnabled(program, !!setting('enabled'))]
            ]);
        });

        const holidayUpdates = programs(HOLIDAY_PROGRAMS).flatMap((program) => {
            const prefix = `holiday_program_${program}`;
            const setting = (key: string) => newSettings[`${prefix}_${key}`];
            return changedUpdates(prefix, [
                ['start_', () => this.setHolidayProgramStart(program, setting('start_date'), setting('start_hour'), setting('start_minute'))],
                ['end_', () => this.setHolidayProgramEnd(program, setting('end_date'), setting('end_hour'), setting('end_minute'))],
                ['temperature_mode', () => this.setHolidayProgramTemperatureMode(program, Number(setting('temperature_mode')))],
                ['fan_speed', () => this.setHolidayProgramFanSpeed(program, Number(setting('fan_speed')))],
                ['enabled', () => this.setHolidayProgramEnabled(program, !!setting('enabled'))]
            ]);
        });

        await super.onSettings(event);
        // Wait for the unit to accept the new values, so a failed write shows an error and the settings are not saved
        await Promise.all([...weekUpdates, ...holidayUpdates].map((update) => update()));
    }

    validateHolidayProgram(program: number, setting: (key: string) => any) {
        const start = this.parseHolidayDate(program, 'start', setting('start_date'));
        const end = this.parseHolidayDate(program, 'end', setting('end_date'));
        if (holidayTime(end, setting('end_hour'), setting('end_minute')) <= holidayTime(start, setting('start_hour'), setting('start_minute'))) {
            throw new Error(`Holiday program ${program}: the end must be after the start`);
        }
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
        this.homey.flow.getDeviceTriggerCard('regulation_mode_changed_iqc').trigger(this, { mode }).catch(this.error);
    }

    isRegulationMode(value: SetRegulationModeIQC) {
        return this.getCapabilityValue('regulation_mode_iqc') === value;
    }

    async setRegulationMode(value: SetRegulationModeIQC) {
        switch (value) {
            case SetRegulationModeIQC.SUPPLY:
                await this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.SUPPLY);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_supply_air')).catch(this.error);
                break;
            case SetRegulationModeIQC.EXTRACT:
                await this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.EXTRACT);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case SetRegulationModeIQC.ROOM:
                await this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.ROOM);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_room')).catch(this.error);
                break;
            case SetRegulationModeIQC.EXTRACT_SW:
                await this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.EXTRACT_SW);
                this.setCapabilityValue('measure_temperature', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                this.setCapabilityValue('measure_temperature.eco', this.getCapabilityValue('meter_temperature_extract_air')).catch(this.error);
                break;
            case SetRegulationModeIQC.ROOM_SW:
                await this.api?.writeRegister(IQCRegisters.holdingRegisters.REGULATION_MODE, RegulationModeIQC.ROOM_SW);
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

        // Discrete inputs
        if (results.discreteInputs.length) {
            this.processFunctions(results.discreteInputs);
        }

        // Input registers
        if (results.inputRegisters.length) {
            if (this.hasCapability('meter_power_heat_recovery')) {
                this.setCapabilityValue('meter_power_heat_recovery', (this.checkNegativeNumber(results.inputRegisters[IQCRegisters.inputRegisters.HEAT_COLR_RECOVERY_POWER]) / 255) * 100).catch(this.error);
            }
            this.processQualitySensors(results.inputRegisters);
            this.processCurrentFanSpeed(results.inputRegisters[IQCRegisters.inputRegisters.CURRENT_SUPPLY_FAN_STEP]);
            this.processWeekProgram(results.inputRegisters[IQCRegisters.inputRegisters.CURRENT_WEEKTIMER_PROGRAM]);
        }

        // Holding registers
        if (results.holdingRegisters.length) {
            this.holdingRegisters = results.holdingRegisters;
            this.setCapabilityValue('target_temperature.eco', results.holdingRegisters[IQCRegisters.holdingRegisters.SETPOINT_TEMPERATURE_ECONOMY]).catch(this.error);
            this.setCapabilityValue('heater_enabled_iqc', !!results.holdingRegisters[IQCRegisters.holdingRegisters.HEATER_ENABLED]).catch(this.error);
            this.setCapabilityValue('preheater_enabled_iqc', !!results.holdingRegisters[IQCRegisters.holdingRegisters.PREHEATER_ENABLED]).catch(this.error);
            this.setCapabilityValue('summer_night_cooling_enabled', !!results.holdingRegisters[IQCRegisters.holdingRegisters.SUMMER_NIGHT_COOLING_ENABLED]).catch(this.error);
            this.processSchedules(results.holdingRegisters);
            this.checkClockDrift(results.holdingRegisters);
        }
    }
}

module.exports = IQCTouch;
