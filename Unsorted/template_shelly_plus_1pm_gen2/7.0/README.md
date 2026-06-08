# Shelly Plus 1PM Gen2

## Overview

Monitors the Shelly Plus 1PM Gen2 smart switch via the Gen2 RPC API over HTTP. Requires network access to the device; no agent needed.

## Author

oscar120584

## Zabbix version

This template is compatible with Zabbix 7.0 and later versions.

## Setup

_TODO: replace this stub._ Describe how to enable data collection on the target and how to link the template to a host.

## Macros used

|Name|Description|Default|Type|
|----|-----------|-------|----|
|{$SHELLYPWD}|Password for admin user, if present|`****`|Secret macro|
|{$SHELLYPWD_USER}|Username for admin user|admin|Text macro|
|{$POLLING_INTERVAL}|How often to poll device status (default: 60 seconds)|60s|Text macro|

## Items collected

|Name|Description|Type|Key and additional info|
|----|-----------|----|-----------------------|
|Status gatherer|This gatherer gathers all the data for the different items from the RPC API of the Shelly Plus 1PM device.|`HTTP agent`|shellyplus1pm.status<p>Update: {$POLLING_INTERVAL}</p>|
|Cloud connection state|Current state of cloud connection|`Dependent item`|shellyplus1pm.status.cloud.connected<p>Update: 0</p>|
|Input state|Current state of input 0|`Dependent item`|shellyplus1pm.status.input0.state<p>Update: 0</p>|
|MQTT connection state|Current state of MQTT connection|`Dependent item`|shellyplus1pm.status.mqtt.connected<p>Update: 0</p>|
|Switch output state|Current output state of switch 0|`Dependent item`|shellyplus1pm.status.switch0.output<p>Update: 0</p>|
|Switch command source|Last source of switch command|`Dependent item`|shellyplus1pm.status.switch0.source<p>Update: 0</p>|
|Current power consumption|Active power being consumed (Watts)|`Dependent item`|shellyplus1pm.status.switch0.apower<p>Update: 0</p>|
|Current voltage|AC voltage (Volts)|`Dependent item`|shellyplus1pm.status.switch0.voltage<p>Update: 0</p>|
|Current amperage|Current being drawn (Amperes)|`Dependent item`|shellyplus1pm.status.switch0.current<p>Update: 0</p>|
|Total energy consumed|Total energy consumed (Watt-hours)|`Dependent item`|shellyplus1pm.status.switch0.aenergy.total<p>Update: 0</p>|
|Energy consumption (1 min avg)|Energy consumption for current minute (Watt-minutes)|`Dependent item`|shellyplus1pm.status.switch0.aenergy.by_minute.0<p>Update: 0</p>|
|Device temperature (°C)|Internal device temperature in Celsius|`Dependent item`|shellyplus1pm.status.switch0.temperature.tC<p>Update: 0</p>|
|MAC address|Device MAC address|`Dependent item`|shellyplus1pm.status.sys.mac<p>Update: 0</p>|
|Uptime|Device uptime in seconds|`Dependent item`|shellyplus1pm.status.sys.uptime<p>Update: 0</p>|
|RAM size|Total RAM size in bytes|`Dependent item`|shellyplus1pm.status.sys.ram_size<p>Update: 0</p>|
|RAM free|Free RAM in bytes|`Dependent item`|shellyplus1pm.status.sys.ram_free<p>Update: 0</p>|
|Filesystem size|Total filesystem size in bytes|`Dependent item`|shellyplus1pm.status.sys.fs_size<p>Update: 0</p>|
|Filesystem free|Free filesystem space in bytes|`Dependent item`|shellyplus1pm.status.sys.fs_free<p>Update: 0</p>|
|WiFi IP address|Current WiFi IP address|`Dependent item`|shellyplus1pm.status.wifi.sta_ip<p>Update: 0</p>|
|WiFi status|Current WiFi connection status|`Dependent item`|shellyplus1pm.status.wifi.status<p>Update: 0</p>|
|WiFi SSID|Connected WiFi network SSID|`Dependent item`|shellyplus1pm.status.wifi.ssid<p>Update: 0</p>|
|WiFi RSSI|WiFi signal strength in dBm|`Dependent item`|shellyplus1pm.status.wifi.rssi<p>Update: 0</p>|
|Firmware update check|Check for available firmware updates|`HTTP agent`|shellyplus1pm.firmware.check<p>Update: 12h</p>|
|Stable firmware available|Whether a stable firmware update is available|`Dependent item`|shellyplus1pm.firmware.stable.available<p>Update: 0</p>|
|Stable firmware version available|Version number of available stable firmware|`Dependent item`|shellyplus1pm.firmware.stable.version<p>Update: 0</p>|
|Device info gatherer|Get device information including current firmware version|`HTTP agent`|shellyplus1pm.deviceinfo<p>Update: {$POLLING_INTERVAL}</p>|
|Current firmware version|Currently installed firmware version|`Dependent item`|shellyplus1pm.firmware.current.version<p>Update: 0</p>|

## Triggers

|Name|Description|Expression|Severity|Additional info|
|----|-----------|----------|--------|---------------|
|Shelly Plus 1PM: No data received for >3m||`nodata(/Shelly Plus 1PM/shellyplus1pm.status,180s)=1`|Warning|Manual close: YES|
|Shelly Plus 1PM: Cloud connection state has changed||`change(/Shelly Plus 1PM/shellyplus1pm.status.cloud.connected)<>0`|Warning|Manual close: YES|
|Shelly Plus 1PM: Input state has changed||`change(/Shelly Plus 1PM/shellyplus1pm.status.input0.state)<>0`|Info|Manual close: YES|
|Shelly Plus 1PM: MQTT connection state has changed||`change(/Shelly Plus 1PM/shellyplus1pm.status.mqtt.connected)<>0`|Warning|Manual close: YES|
|Shelly Plus 1PM: Switch state has changed||`change(/Shelly Plus 1PM/shellyplus1pm.status.switch0.output)<>0`|Warning|Manual close: YES|
|Shelly Plus 1PM: Device temperature is high||`last(/Shelly Plus 1PM/shellyplus1pm.status.switch0.temperature.tC)>70`|Average|-|
|Shelly Plus 1PM: Device temperature is very high||`last(/Shelly Plus 1PM/shellyplus1pm.status.switch0.temperature.tC)>85`|High|-|
|Shelly Plus 1PM: Device has been restarted (Uptime <10m)||`last(/Shelly Plus 1PM/shellyplus1pm.status.sys.uptime)<600`|Warning|-|
|Shelly Plus 1PM: Filesystem usage >=80%||`(last(/Shelly Plus 1PM/shellyplus1pm.status.sys.fs_free)/last(/Shelly Plus 1PM/shellyplus1pm.status.sys.fs_size))<0.2`|Warning|-|
|Shelly Plus 1PM: Filesystem usage >=90%||`(last(/Shelly Plus 1PM/shellyplus1pm.status.sys.fs_free)/last(/Shelly Plus 1PM/shellyplus1pm.status.sys.fs_size))<0.1`|Average|-|
|Shelly Plus 1PM: WiFi connection is down||`find(/Shelly Plus 1PM/shellyplus1pm.status.wifi.status,,"regex","^(got ip)$")=0`|Average|-|
|Shelly Plus 1PM: WiFi signal is weak||`last(/Shelly Plus 1PM/shellyplus1pm.status.wifi.rssi)<-80`|Warning|-|

## Discovery rules

There are no discovery rules in this template.

## Template links

There are no template links in this template.

## Feedback

Please report any issues with the template at the [Zabbix community templates repository](https://github.com/zabbix/community-templates/issues).
