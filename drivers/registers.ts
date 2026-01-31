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
    CURRENT_FAN_SPEED = 21
}

enum Gen3HoldingRegisters {
    USER_FAN_SPEED,
    HEATER_ENABLED = 50,
    WEEK_TIMER_ENABLED = 68
}

enum IQCInputRegisters {
    CHANGEOVER_ACTIVE = 33
}

enum IQCHoldingRegisters {
    SETPOINT_TEMPERATURE_ECONOMY,
    PREHEATER_ENABLED = 63,
    HEATER_ENABLED = 66
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
