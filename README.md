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

stat

## General info

Since Östberg has changed naming convention between the Gen 3 and the IQC for Exhaust/Extract/Waste I am following this:

-   Supply: From the unit to the rooms
-   Extract: From the rooms to the unit
-   Waste: From the unit and out of the house
-   Outdoor: From the outside and in to the unit

**Clear alarms** and **Reset filter timer** did not work for me, so the flows for this are left out of the application as of now. If you own a system with the IQC Touch panel and want to test if this could work on your system, please contact me.

I am also getting alarms on **Supply fan** and **Extract fan** during normal operation, Östberg said that it could possibly a incorrect modbus configuration on their side.

## Disclaimer

-   I take no responsibility for any damages caused by the use of this app.

# Changelog

## 1.1.0

### Feature

-   Added support for direct TCP/IP connection for IQC Touch unit

## 1.0.1

### Bug fix

-   Fixed issue where negative numbers would not display correctly.

## 1.0.0

### Feature

-   Initial version
