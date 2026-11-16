# Östberg Heru

## What

Control your Östberg Heru ventilation system with Homey Pro.

## Why

-   Set your ventilation system to away mode automatically when you leave the house.
-   Lower heating during the night.
-   Get notified when alarms become active or reset
-   Automatically turn on boost mode when showering
-   ... and more

## How

### Gen 3 with Remote

Make sure you system first has modbus enabled from the remote by going to the _Service menu_ and log in with the code 1199. If you don't see a setting for Modbus it means you have to first buy a new remote with modbus and pair it to your ventilation system to enable the modbus.

When modbus is enabled you need a TCP/IP to RS485 converter to connect to your Heru unit. I have personally confirmed it working with two different types:

-   Moxa NPORT 5232I
-   Ebyte 810-DTU V2 (By far the cheapest, about $20 on ebay)

You need to configure this converter with a IP and a ort that this app will connect to. Connect the three wires (D-/A,D+/B,0/GND) to your ventilation systems Modbus interface port. Make sure the settings on the TCP/IP to RS485 converter matches your ventilation system serial settings.

I am using the following on my system (Heru 100T EC, Gen 3 with the modbus remote):

-   Baud rate: 9600
-   Data bits: 8
-   Parity: none
-   Stop bit: 1

### IQC Touch

TCP/IP directly towards the Heru unit (preferred), or through a TCP/IP to RS485 converter (I have not confirmed that the newer generation have the serial interface still, but the support for it is currently there to be sure).

## General info

Since Östberg has changed naming convention between the Gen 3 and the IQC for Exhaust/Extract/Waste I am following this:

-   Supply: From the unit to the rooms
-   Extract: From the rooms to the unit
-   Waste: From the unit and out of the house
-   Outdoor: From the outside and in to the unit

**Reset filter timer** and **Clear alarms** are available for Gen 3 and IQC Touch under *Device settings → Maintenance actions*. They are written as a single coil write (Modbus function 5), as an earlier attempt with function 15 did not work. Resetting the filter timer does not dismiss the filter alarm, use **Clear alarms** for that.

Alarms used to be read from the wrong Modbus addresses, which caused false **Supply fan** and **Extract fan** alarms during normal operation (they were actually the *Heating* and *Heat recovery* status). This is fixed, so after updating the alarms reflect the real state of the unit.

### Gen 3: clock

The week timer runs on the unit's own clock. Enable **Keep the unit's clock in sync with Homey** in the device settings to have the app correct the clock whenever it is more than 2 minutes off (for example after a daylight saving time change), or use the **Set the unit's clock to Homey's time** flow card.

### IQC Touch: schedules and clock

The week schedule (5 programs) and the holiday schedule (10 programs) of the IQC are shown in the device settings, and follow changes made on the IQC panel. Each program has a fan speed (Standby, Min, Standard or Max, as the IQC has four fan speeds) and a temperature mode (Comfort or Economy, Economy is only used when the economy setpoint is enabled on the unit). Holiday programs take a start and end date as YYYY-MM-DD. Both schedules can also be changed with flow cards.

Like the Gen 3 week timer, the schedules run on the unit's own clock. Enable **Keep the unit's clock in sync with Homey** or use the **Set the unit's clock to Homey's time** flow card.

CO₂ and relative humidity are read from the RH/CO₂/VOC sensors connected to the unit. When two sensors of the same type are connected, the highest value is shown, as the unit does.

The schedule, clock and sensor registers are read separately from the rest. If the unit's firmware doesn't have them, these features are skipped and the rest of the device keeps working.

## Disclaimer

-   I take no responsibility for any damages caused by the use of this app.

# Changelog

## Unreleased

### Feature
- IQC Touch: Week schedule and holiday schedule in the device settings, with flow cards to change them
- IQC Touch: Current fan speed, set by the user or the schedules
- IQC Touch: Heating, heat recovery, cooling, CO₂ boost and humidity boost status, with flow cards for when they start or stop
- IQC Touch: CO₂, relative humidity and heat recovery power
- IQC Touch: Keep the unit's clock in sync with Homey, and a flow card to set it
- IQC Touch: Reset the filter timer and clear alarms from the device's maintenance actions

## 1.8.0

### Feature
- Gen 3: Current fan speed, set by the user or the week timer
- Gen 3: Heating, heat recovery, CO₂ boost and humidity boost status, with flow cards for when they start or stop
- Gen 3: Heat recovery power and relative humidity
- Gen 3: Keep the unit's clock in sync with Homey, and a flow card to set it
- Gen 3: Flow cards for the week timer being enabled, the active program and the current fan speed
- Gen 3: Reset the filter timer and clear alarms from the device's maintenance actions
- Show an error when a command can't be written to the unit, instead of silently ignoring it

### Bug fix
- The device could stop updating until the app was restarted
- The device could become unavailable for a few seconds on a slow connection
- Alarms and status flags were read from the wrong Modbus addresses
- Gen 3: The active week timer program was only updated when the CO₂ capability was enabled

## 1.7.0

### Feature
- Added Summer Night Cooling enable/disable

## 1.6.0

### Change

- Single decimal instead of zero.

### Feature

- Added thermal efficiency capability - IQC and gen3
- Added week timer functionality (gen3)

## 1.5.0

### Feature

 - Added power and energy approximation

### Bug fix

- Does not set device unavailable after a single read error.

## 1.4.0

### Feature

- Added heater enabled/disabled for Gen3 Remote

## 1.3.0

### Feature

-   Added heater and preheater enabled/disabled functionality for IQC Touch

## 1.2.0

### Feature

-   Adjustable polling interval. Modbus timeout will be half of this value.
-   Alarms can be inverted.

### Bug fix

-   IQC Touch: Fixed issue where reading ECO temperature didn't update until setting a new target temperature.

## 1.1.3

### Bug fix

-   Error handling improvements

## 1.1.2

### Bug fix

-   Fixed issue where ECO setpoint was not updated for IQC Touch

## 1.1.1

### Bug fix

-   Fixed issue with trigger of Fan mode changed for IQC Touch

## 1.1.0

### Feature

-   Added support for direct TCP/IP connection for IQC Touch unit

## 1.0.1

### Bug fix

-   Fixed issue where negative numbers would not display correctly.

## 1.0.0

### Feature

-   Initial version
