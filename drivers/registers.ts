enum baseCoils {
    UNIT_ON,
    OVERPRESSURE,
    BOOST,
    AWAY,
    CLEAR_ALARMS,
    RESET_FILTER_TIMER
}

enum baseDiscreteInputs {
    FIRE_ALARM_SWITCH,
    BOOST_SWITCH,
    OVERPRESSURE_SWITCH,
    AUX_SWITCH,
    FIRE_ALARM = 9,
    ROTOR_ALARM,
    FREEZE_ALARM = 12,
    LOW_SUPPLY_ALARM,
    LOW_ROTOR_TEMPEARTURE_ALARM,
    TEMP_SENSOR_OPEN_CIRCUIT_ALARM = 17,
    TEMP_SENSOR_SHORT_CIRCUIT_ALARM,
    PULSER_ALARM,
    SUPPLY_FAN_ALARM,
    EXHAUST_FAN_ALARM,
    SUPPLY_FILTER_ALARM,
    EXHAUST_FILTER_ALARM,
    FILTER_TIMER_ALARM,
    FREEZE_PROTECTION_B_LEVEL,
    FREEZE_PROTECTION_A_LEVEL,
    STARTUP_1ST_PHASE,
    STARTUP_2ND_PHASE,
    HEATING,
    RECOVERING_HEAT_COLD,
    COOLING,
    CO2_BOOST,
    RH_BOOST
}

enum baseInputRegisters {
    COMPONENT_ID,
    OUTDOOR_TEMPERATURE,
    SUPPLY_AIR_TEMPERATURE,
    EXTRACT_AIR_TEMPERATURE,
    EXHAUST_AIR_TEMPERATURE,
    WATER_TEMPERATURE,
    HEAT_RECOVERY_TEMPERATURE,
    ROOM_TEMPERATURE,
    SUPPLY_PRESSURE = 11,
    EXHAUST_PRESSURE,
    SENSORS_OPEN = 17,
    SENSORS_SHORTED,
    FILTER_DAYS_LEFT,
    CURRENT_WEEKTIMER_PROGRAM,
    CURRENT_SUPPLY_FAN_STEP = 22,
    CURRENT_EXHAUST_FAN_STEP,
    SUPPLY_FAN_POWER,
    EXHAUST_FAN_POWER,
    SUPPLY_FAN_SPEED,
    EXHAUST_FAN_SPEED,
    HEATING_POWER,
    HEAT_COLR_RECOVERY_POWER,
    COOLING_POWER,
    SUPPLY_FAN_CONTROL_VOLTAGE,
    EXHAUST_FAN_CONTROL_VOLTAGE
}

enum baseHoldingRegisters {
    SETPOINT_TEMPERATURE = 1,
    SUPPLY_FAN_SPEED,
    EXHAUST_FAN_SPEED,
    MIN_SUPPLY_FAN_SPEED,
    MAX_SUPPLY_FAN_SPEED,
    REGULATION_MODE = 11
}

enum Gen3InputRegisters {
    RELATIVE_HUMIDITY = 13,
    CARBON_DIOXIDE = 14,
    WEEK_TIMER_CURRENT_ACTIVE_PROGRAM = 20,
    CURRENT_FAN_SPEED = 21
}

export enum Gen3HoldingRegisters {
    USER_FAN_SPEED,
    SUMMER_NIGHT_COOLING_ENABLED = 15,
    HEATER_ENABLED = 50,
    // Reading the weekday copies the unit's time to a buffer, writing the seconds applies the buffer to the unit's clock
    CLOCK_WEEKDAY = 59,
    CLOCK_HOURS,
    CLOCK_MINUTES,
    CLOCK_SECONDS,
    WEEK_TIMER_ENABLED = 68,
    WEEK_TIMER_PROGRAM_1_START_HOUR,
    WEEK_TIMER_PROGRAM_1_START_MINUTE,
    WEEK_TIMER_PROGRAM_1_END_HOUR,
    WEEK_TIMER_PROGRAM_1_END_MINUTE,
    WEEK_TIMER_PROGRAM_1_WEEKDAYS,
    WEEK_TIMER_PROGRAM_1_TEMPERATURE,
    WEEK_TIMER_PROGRAM_1_FAN_SPEED,
    WEEK_TIMER_PROGRAM_2_START_HOUR = 79,
    WEEK_TIMER_PROGRAM_2_START_MINUTE,
    WEEK_TIMER_PROGRAM_2_END_HOUR,
    WEEK_TIMER_PROGRAM_2_END_MINUTE,
    WEEK_TIMER_PROGRAM_2_WEEKDAYS,
    WEEK_TIMER_PROGRAM_2_TEMPERATURE,
    WEEK_TIMER_PROGRAM_2_FAN_SPEED,
    WEEK_TIMER_PROGRAM_3_START_HOUR = 89,
    WEEK_TIMER_PROGRAM_3_START_MINUTE,
    WEEK_TIMER_PROGRAM_3_END_HOUR,
    WEEK_TIMER_PROGRAM_3_END_MINUTE,
    WEEK_TIMER_PROGRAM_3_WEEKDAYS,
    WEEK_TIMER_PROGRAM_3_TEMPERATURE,
    WEEK_TIMER_PROGRAM_3_FAN_SPEED,
    WEEK_TIMER_PROGRAM_4_START_HOUR = 99,
    WEEK_TIMER_PROGRAM_4_START_MINUTE,
    WEEK_TIMER_PROGRAM_4_END_HOUR,
    WEEK_TIMER_PROGRAM_4_END_MINUTE,
    WEEK_TIMER_PROGRAM_4_WEEKDAYS,
    WEEK_TIMER_PROGRAM_4_TEMPERATURE,
    WEEK_TIMER_PROGRAM_4_FAN_SPEED,
    WEEK_TIMER_PROGRAM_5_START_HOUR = 109,
    WEEK_TIMER_PROGRAM_5_START_MINUTE,
    WEEK_TIMER_PROGRAM_5_END_HOUR,
    WEEK_TIMER_PROGRAM_5_END_MINUTE,
    WEEK_TIMER_PROGRAM_5_WEEKDAYS,
    WEEK_TIMER_PROGRAM_5_TEMPERATURE,
    WEEK_TIMER_PROGRAM_5_FAN_SPEED
}

enum IQCInputRegisters {
    CHANGEOVER_ACTIVE = 33,
    // Three quality sensors, each a type (0 = none, 1 = RH, 2 = CO2, 3 = VOC) followed by its value
    QUALITY_SENSOR_1_TYPE = 40,
    QUALITY_SENSOR_1_VALUE,
    QUALITY_SENSOR_2_TYPE,
    QUALITY_SENSOR_2_VALUE,
    QUALITY_SENSOR_3_TYPE,
    QUALITY_SENSOR_3_VALUE
}

export enum IQCHoldingRegisters {
    SETPOINT_TEMPERATURE_ECONOMY,
    SUMMER_NIGHT_COOLING_ENABLED = 18,
    PREHEATER_ENABLED = 63,
    HEATER_ENABLED = 66,
    WEEK_SCHEDULE_ENABLED = 139,
    HOLIDAY_SCHEDULE_ENABLED = 199,
    // Reading the day copies the unit's time to a buffer, writing the seconds applies the buffer to the unit's clock
    CLOCK_YEAR = 399,
    CLOCK_MONTH,
    CLOCK_DAY,
    CLOCK_HOURS,
    CLOCK_MINUTES,
    CLOCK_SECONDS
}

// Week schedule program 1 starts at 4x00141, each next program 10 registers further
export enum IQCWeekProgramField {
    START_HOUR,
    START_MINUTE,
    END_HOUR,
    END_MINUTE,
    WEEKDAYS,
    TEMPERATURE_MODE,
    FAN_SPEED,
    ENABLED
}

export function iqcWeekProgramRegister(program: number, field: IQCWeekProgramField) {
    return 140 + (program - 1) * 10 + field;
}

// Holiday schedule program 1 starts at 4x00201, each next program 20 registers further
export enum IQCHolidayProgramField {
    START_YEAR,
    // Month and day as MMDD, so 1102 is 2 November
    START_DATE,
    START_HOUR,
    START_MINUTE,
    END_YEAR,
    END_DATE,
    END_HOUR,
    END_MINUTE,
    TEMPERATURE_MODE,
    FAN_SPEED,
    // Bit 0 is on/off
    ENABLED
}

export function iqcHolidayProgramRegister(program: number, field: IQCHolidayProgramField) {
    return 200 + (program - 1) * 20 + field;
}

enum IQCDiscreteInputs {
    PUMP_ALARM_HEATING = 34,
    PUMP_ALARM_COOLING
}

export const IQCRegisters = {
    coils: baseCoils,
    discreteInputs: { ...baseDiscreteInputs, ...IQCDiscreteInputs },
    inputRegisters: { ...baseInputRegisters, ...IQCInputRegisters },
    holdingRegisters: { ...baseHoldingRegisters, ...IQCHoldingRegisters }
};

export const Gen3Registers = {
    coils: baseCoils,
    discreteInputs: baseDiscreteInputs,
    inputRegisters: { ...baseInputRegisters, ...Gen3InputRegisters },
    holdingRegisters: { ...baseHoldingRegisters, ...Gen3HoldingRegisters }
};

export const BaseRegisters = {
    holdingRegisters: baseHoldingRegisters,
    inputRegisters: baseInputRegisters,
    coils: baseCoils,
    discreteInputs: baseDiscreteInputs
};
