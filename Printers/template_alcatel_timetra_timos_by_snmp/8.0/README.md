# Alcatel Timetra TiMOS by SNMP

## Overview

тестовый шаблон для добавки

## Author

ya_lubimy

## Zabbix version

This template is compatible with Zabbix 8.0 and later versions.

## Setup

_TODO: replace this stub._ Describe how to enable data collection on the target and how to link the template to a host.

## Macros used

There are no user macros in this template.

## Items collected

|Name|Description|Type|Key and additional info|
|----|-----------|----|-----------------------|
|ICMP ping|The host accessibility by ICMP ping.  0 - ICMP ping fails; 1 - ICMP ping successful.|`Simple check`|icmpping|
|ICMP loss|The percentage of lost packets.|`Simple check`|icmppingloss|
|ICMP response time|The ICMP ping response time (in seconds).|`Simple check`|icmppingsec|
|SNMP traps (fallback)|The item is used to collect all SNMP traps unmatched by other snmptrap items|`SNMP trap`|snmptrap.fallback|
|System contact details|MIB: SNMPv2-MIB The textual identification of the contact person for this managed node, together with information on how to contact this person. If no contact information is known, the value is the zero-length string.|`SNMP agent`|system.contact[sysContact.0]<p>Update: 15m</p>|
|CPU utilization|MIB: TIMETRA-SYSTEM-MIB The value of sgiCpuUsage indicates the current CPU utilization for the system.|`SNMP agent`|system.cpu.util[sgiCpuUsage.0]|
|System description|MIB: SNMPv2-MIB A textual description of the entity. This value should include the full name and version identification of the system's hardware type, software operating-system, and networking software.|`SNMP agent`|system.descr[sysDescr.0]<p>Update: 15m</p>|
|Hardware model name|MIB: SNMPv2-MIB|`SNMP agent`|system.hw.model<p>Update: 1h</p>|
|Uptime (hardware)|MIB: HOST-RESOURCES-MIB The amount of time since this host was last initialized. Note that this is different from sysUpTime in the SNMPv2-MIB [RFC1907] because sysUpTime is the uptime of the network management portion of the system.|`SNMP agent`|system.hw.uptime[hrSystemUptime.0]<p>Update: 30s</p>|
|System location|MIB: SNMPv2-MIB Physical location of the node (e.g., `equipment room`, `3rd floor`). If not provided, the value is a zero-length string.|`SNMP agent`|system.location[sysLocation.0]<p>Update: 15m</p>|
|System name|MIB: SNMPv2-MIB An administratively-assigned name for this managed node.By convention, this is the node's fully-qualified domain name. If the name is unknown, the value is the zero-length string.|`SNMP agent`|system.name<p>Update: 15m</p>|
|Uptime (network)|MIB: SNMPv2-MIB Time (in hundredths of a second) since the network management portion of the system was last re-initialized.|`SNMP agent`|system.net.uptime[sysUpTime.0]<p>Update: 30s</p>|
|System object ID|MIB: SNMPv2-MIB The vendor's authoritative identification of the network management subsystem contained in the entity. This value is allocated within the SMI enterprises subtree (1.3.6.1.4.1) and provides an easy and unambiguous means for determining`what kind of box' is being managed.  For example, if vendor`Flintstones, Inc.' was assigned the subtree1.3.6.1.4.1.4242, it could assign the identifier 1.3.6.1.4.1.4242.1.1 to its `Fred Router'.|`SNMP agent`|system.objectid[sysObjectID.0]<p>Update: 15m</p>|
|Operating system|MIB: SNMPv2-MIB|`SNMP agent`|system.sw.os[sysDescr.0]<p>Update: 1h</p>|
|Available memory|MIB: TIMETRA-SYSTEM-MIB The value of sgiKbMemoryAvailable indicates the amount of free memory, in kilobytes, in the overall system that is not allocated to memory pools, but is available in case a memory pool needs to grow.|`SNMP agent`|vm.memory.available[sgiKbMemoryAvailable.0]|
|Total memory|The total memory expressed in bytes.|`Calculated`|vm.memory.total[snmp]|
|Used memory|MIB: TIMETRA-SYSTEM-MIB The value of sgiKbMemoryUsed indicates the total pre-allocated pool memory, in kilobytes, currently in use on the system.|`SNMP agent`|vm.memory.used[sgiKbMemoryUsed.0]|
|Memory utilization|Memory utilization in %.|`Calculated`|vm.memory.util[vm.memory.util.0]|
|SNMP agent availability|Availability of SNMP checks on the host. The value of this item corresponds to availability icons in the host list. Possible values: 0 - not available 1 - available 2 - unknown|`Zabbix internal`|zabbix[host,snmp,available]|

## Triggers

|Name|Description|Expression|Severity|Additional info|
|----|-----------|----------|--------|---------------|
|Alcatel TiMOS: Unavailable by ICMP ping|Last three attempts returned timeout. Please check device connectivity.|`max(/Alcatel Timetra TiMOS by SNMP/icmpping,#3)=0`|High|-|
|Alcatel TiMOS: High ICMP ping loss|ICMP packets loss detected.|`min(/Alcatel Timetra TiMOS by SNMP/icmppingloss,5m)>{$ICMP_LOSS_WARN} and min(/Alcatel Timetra TiMOS by SNMP/icmppingloss,5m)<100`|Warning|-|
|Alcatel TiMOS: High ICMP ping response time|Average ICMP response time is too high.|`avg(/Alcatel Timetra TiMOS by SNMP/icmppingsec,5m)>{$ICMP_RESPONSE_TIME_WARN}`|Warning|-|
|Alcatel TiMOS: High CPU utilization|The CPU utilization is too high. The system might be slow to respond.|`min(/Alcatel Timetra TiMOS by SNMP/system.cpu.util[sgiCpuUsage.0],5m)>{$CPU.UTIL.CRIT}`|Warning|-|
|Alcatel TiMOS: System name has changed|The name of the system has changed. Acknowledge to close the problem manually.|`last(/Alcatel Timetra TiMOS by SNMP/system.name,#1)<>last(/Alcatel Timetra TiMOS by SNMP/system.name,#2) and length(last(/Alcatel Timetra TiMOS by SNMP/system.name))>0`|Info|Manual close: YES|
|Alcatel TiMOS: Operating system description has changed|The description of the operating system has changed. Possible reasons are that the system has been updated or replaced. Acknowledge to close the problem manually.|`last(/Alcatel Timetra TiMOS by SNMP/system.sw.os[sysDescr.0],#1)<>last(/Alcatel Timetra TiMOS by SNMP/system.sw.os[sysDescr.0],#2) and length(last(/Alcatel Timetra TiMOS by SNMP/system.sw.os[sysDescr.0]))>0`|Info|Manual close: YES|
|Alcatel TiMOS: High memory utilization|The system is running out of free memory.|`min(/Alcatel Timetra TiMOS by SNMP/vm.memory.util[vm.memory.util.0],5m)>{$MEMORY.UTIL.MAX}`|Average|-|
|Alcatel TiMOS: No SNMP data collection|SNMP is not available for polling. Please check device connectivity and SNMP settings.|`max(/Alcatel Timetra TiMOS by SNMP/zabbix[host,snmp,available],{$SNMP.TIMEOUT})=0`|Warning|-|

## Discovery rules

|Name|Item prototypes|Trigger prototypes|
|----|---------------|------------------|
|Entity Serial Numbers Discovery|13|8|
|FAN Discovery|13|8|
|Network interfaces discovery|13|8|
|EtherLike-MIB Discovery|13|8|
|PSU Discovery|13|8|

## Template links

There are no template links in this template.

## Feedback

Please report any issues with the template at the [Zabbix community templates repository](https://github.com/zabbix/community-templates/issues).
