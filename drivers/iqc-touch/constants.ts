import { alarms as gen3Alarms, alarmInputs as gen3AlarmInputs, functionInputs as gen3FunctionInputs } from '../gen-3-remote/constants';
import { IQCRegisters } from '../registers';

export const alarms = {
    ...gen3Alarms,
    pump_alarm_heating: 'Pump alarm - heating',
    pump_alarm_cooling: 'Pump alarm - cooling'
} as { [index: string]: string };

export const alarmInputs = {
    ...gen3AlarmInputs,
    pump_alarm_heating: IQCRegisters.discreteInputs.PUMP_ALARM_HEATING,
    pump_alarm_cooling: IQCRegisters.discreteInputs.PUMP_ALARM_COOLING
} as { [id: string]: number };

// The IQC can also have a cooler
export const functionInputs = {
    heating: gen3FunctionInputs.heating,
    heat_recovery: gen3FunctionInputs.heat_recovery,
    cooling: IQCRegisters.discreteInputs.COOLING,
    co2_boost: gen3FunctionInputs.co2_boost,
    rh_boost: gen3FunctionInputs.rh_boost
} as { [fn: string]: number };

export const WEEK_PROGRAMS = 5;
export const HOLIDAY_PROGRAMS = 10;

export const registers: ModbusRegisters = {
    coils: {
        start: 0,
        count: 6
    },
    discreteInputs: {
        start: 9,
        count: 27
    },
    inputRegisters: [
        {
            start: 0,
            count: 33
        },
        // Quality sensors (RH/CO2/VOC)
        {
            start: 40,
            count: 6,
            optional: true
        }
    ],
    // One Modbus request reads at most 125 registers, so the schedules and the clock are read separately
    holdingRegisters: [
        {
            start: 0,
            count: 67
        },
        // Week schedule: enabled flag and programs 1-5
        {
            start: 139,
            count: 49,
            optional: true
        },
        // Holiday schedule: enabled flag and programs 1-5
        {
            start: 199,
            count: 92,
            optional: true
        },
        // Holiday schedule programs 6-10
        {
            start: 300,
            count: 91,
            optional: true
        },
        // Clock
        {
            start: 399,
            count: 6,
            optional: true
        }
    ]
};

export enum SetRegulationModeIQC {
    SUPPLY = 'supply',
    EXTRACT = 'extract',
    ROOM = 'room',
    EXTRACT_SW = 'extract_sw',
    ROOM_SW = 'room_sw'
}

export enum RegulationModeIQC {
    SUPPLY,
    EXTRACT,
    ROOM,
    EXTRACT_SW,
    ROOM_SW
}

// The IQC has four fan speed steps, where the Gen 3 has five
export enum FanSpeedIQC {
    OFF,
    MIN,
    STD,
    MAX
}

export enum QualitySensorTypeIQC {
    NONE,
    RH,
    CO2,
    VOC
}
