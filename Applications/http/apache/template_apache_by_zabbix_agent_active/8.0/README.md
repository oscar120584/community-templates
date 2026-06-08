# Apache by Zabbix agent active

## Overview

Test

## Author

Alexander Bakaldin

## Zabbix version

This template is compatible with Zabbix 8.0 and later versions.

## Setup

Cooooooooooooooooooooooooooool

## Macros used

|Name|Description|Default|Type|
|----|-----------|-------|----|
|{$APACHE.PROCESS.NAME.PARAMETER}|The process name of the Apache web server used in the item key `proc.get`. It could be specified if the correct process name is known.||Text macro|
|{$APACHE.PROCESS_NAME}|The process name filter for the Apache process discovery.|(httpd\|apache2)|Text macro|
|{$APACHE.RESPONSE_TIME.MAX.WARN}|The maximum Apache response time expressed in seconds for a trigger expression.|10|Text macro|
|{$APACHE.STATUS.HOST}|The hostname or IP address of the Apache status page.|127.0.0.1|Text macro|
|{$APACHE.STATUS.PATH}|The URL path of the Apache status page.|server-status?auto|Text macro|
|{$APACHE.STATUS.PORT}|The port of the Apache status page.|80|Text macro|
|{$APACHE.STATUS.SCHEME}|The request scheme, which may be either HTTP or HTTPS.|http|Text macro|

## Items collected

|Name|Description|Type|Key and additional info|
|----|-----------|----|-----------------------|
|Total bytes|The total bytes served.|`Dependent item`|apache.bytes|
|Bytes per second|It is calculated as a rate of change for total bytes statistics. `BytesPerSec` is not used, as it counts the average since the last Apache server start.|`Dependent item`|apache.bytes.rate|
|Total requests|The total number of the Apache server accesses.|`Dependent item`|apache.requests|
|Requests per second|It is calculated as a rate of change for the "Total requests" statistics. `ReqPerSec` is not used, as it counts the average since the last Apache server start.|`Dependent item`|apache.requests.rate|
|Uptime|The service uptime expressed in seconds.|`Dependent item`|apache.uptime|
|Version|The Apache service version.|`Dependent item`|apache.version|
|Workers idle cleanup|The number of workers in cleanup state.|`Dependent item`|apache.workers.cleanup|
|Workers closing connection|The number of workers in closing state.|`Dependent item`|apache.workers.closing|
|Workers DNS lookup|The number of workers in `dnslookup` state.|`Dependent item`|apache.workers.dnslookup|
|Workers finishing|The number of workers in finishing state.|`Dependent item`|apache.workers.finishing|
|Workers keepalive (read)|The number of workers in `keepalive` state.|`Dependent item`|apache.workers.keepalive|
|Workers logging|The number of workers in logging state.|`Dependent item`|apache.workers.logging|
|Workers reading request|The number of workers in reading state.|`Dependent item`|apache.workers.reading|
|Workers sending reply|The number of workers in sending state.|`Dependent item`|apache.workers.sending|
|Workers slot with no current process|The number of slots with no current process.|`Dependent item`|apache.workers.slot|
|Workers starting up|The number of workers in starting state.|`Dependent item`|apache.workers.starting|
|Workers waiting for connection|The number of workers in waiting state.|`Dependent item`|apache.workers.waiting|
|Total workers busy|The total number of busy worker threads/processes.|`Dependent item`|apache.workers_total.busy|
|Total workers idle|The total number of idle worker threads/processes.|`Dependent item`|apache.workers_total.idle|
|Service response time||`Zabbix agent (active)`|net.tcp.service.perf[http,"{$APACHE.STATUS.HOST}","{$APACHE.STATUS.PORT}"]|
|Service ping||`Zabbix agent (active)`|net.tcp.service[http,"{$APACHE.STATUS.HOST}","{$APACHE.STATUS.PORT}"]|
|Get processes summary|The aggregated data of summary metrics for all processes.|`Zabbix agent (active)`|proc.get[{$APACHE.PROCESS.NAME.PARAMETER},,,summary]|
|Get status|Getting data from a machine-readable version of the Apache status page. For more information see Apache Module [mod_status](https://httpd.apache.org/docs/current/mod/mod_status.html).|`Zabbix agent (active)`|web.page.get["{$APACHE.STATUS.SCHEME}://{$APACHE.STATUS.HOST}:{$APACHE.STATUS.PORT}/{$APACHE.STATUS.PATH}"]|

## Triggers

|Name|Description|Expression|Severity|Additional info|
|----|-----------|----------|--------|---------------|
|Apache: Service has been restarted|Uptime is less than 10 minutes.|`last(/Apache by Zabbix agent active/apache.uptime)<10m`|Info|Manual close: YES|
|Apache: Version has changed|Apache version has changed. Acknowledge to close the problem manually.|`last(/Apache by Zabbix agent active/apache.version,#1)<>last(/Apache by Zabbix agent active/apache.version,#2) and length(last(/Apache by Zabbix agent active/apache.version))>0`|Info|Manual close: YES|

## Discovery rules

|Name|Item prototypes|Trigger prototypes|
|----|---------------|------------------|
|Event MPM discovery|12|4|
|Apache process discovery|12|4|

## Template links

There are no template links in this template.

## Feedback

Please report any issues with the template at the [Zabbix community templates repository](https://github.com/zabbix/community-templates/issues).
