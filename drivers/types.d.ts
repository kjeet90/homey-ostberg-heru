declare global {
    interface ModbusRange {
        start: number;
        count: number;
    }
    interface ModbusRegisters {
        coils: ModbusRange;
        discreteInputs: ModbusRange;
        inputRegisters: ModbusRange;
        holdingRegisters: ModbusRange;
    }

}

export { }