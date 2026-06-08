# Proxmox VE by HTTP

## Overview

Test template

## Author

Alexander Bakaldin

## Zabbix version

This template is compatible with Zabbix 8.0 and later versions.

## Setup

Coooool

## Macros used

|Name|Description|Default|Type|
|----|-----------|-------|----|
|{$PVE.FILTER.CERT.FILE.MATCH}|Filter for certificate file discovery by name.|.*|Text macro|
|{$PVE.FILTER.CERT.FILE.NOTMATCH}|Exclude filter for certificate file discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.DISK.MATCH}|Filter for disk discovery by name.|.*|Text macro|
|{$PVE.FILTER.DISK.NOTMATCH}|Exclude filter for disk discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.LXC.MATCH}|Filter for LXC discovery by name.|.*|Text macro|
|{$PVE.FILTER.LXC.NOTMATCH}|Exclude filter for LXC discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.NODE.MATCH}|Filter for node discovery by name.|.*|Text macro|
|{$PVE.FILTER.NODE.NOTMATCH}|Exclude filter for node discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.NODE.STATUS}|Filter for node discovery by status.|.*|Text macro|
|{$PVE.FILTER.QEMU.FS.MOUNT_POINT.MATCH}|Filter for QEMU virtual machine filesystem discovery by mount point.|.*|Text macro|
|{$PVE.FILTER.QEMU.FS.MOUNT_POINT.NOTMATCH}|Exclude filter for QEMU virtual machine filesystem discovery by mount point.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.QEMU.FS.TYPE.MATCH}|Filter for QEMU virtual machine filesystem discovery by type.|.*|Text macro|
|{$PVE.FILTER.QEMU.FS.TYPE.NOTMATCH}|Exclude filter for QEMU virtual machine filesystem discovery by type.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.QEMU.MATCH}|Filter for QEMU virtual machine discovery by name.|.*|Text macro|
|{$PVE.FILTER.QEMU.NET.IFACE.NAME.MATCH}|Filter for QEMU virtual machine network interface discovery by name.|.*|Text macro|
|{$PVE.FILTER.QEMU.NET.IFACE.NAME.NOTMATCH}|Exclude filter for QEMU virtual machine network interface discovery by name.|lo\|Loopback.*|Text macro|
|{$PVE.FILTER.QEMU.NOTMATCH}|Exclude filter for QEMU virtual machine discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.QEMU.OS.METRIC.MATCH}|Filter for QEMU virtual machine OS metric discovery by name.|.*|Text macro|
|{$PVE.FILTER.QEMU.OS.METRIC.NOTMATCH}|Exclude filter for QEMU virtual machine OS metric discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.QEMULXC.STATUS.MATCH}|Filter for QEMU and LXC discovery by status.|.*|Text macro|
|{$PVE.FILTER.STORAGE.NAME.MATCH}|Filter for storage discovery by name.|.*|Text macro|
|{$PVE.FILTER.STORAGE.NAME.NOTMATCH}|Exclude filter for storage discovery by name.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.FILTER.USER.MATCH}|Filter for user discovery by fullname.|.*|Text macro|
|{$PVE.FILTER.USER.NOTMATCH}|Exclude filter for user discovery by fullname.|CHANGE_ME_IF_NEEDED|Text macro|
|{$PVE.LLD.ENABLE.CERT}|Enable discovery of node certificates.|.*|Text macro|
|{$PVE.LLD.ENABLE.DISK}|Enable discovery of node disks.|.*|Text macro|
|{$PVE.LLD.ENABLE.STORAGE}|Enable discovery of node storage.|.*|Text macro|
|{$PVE.PARAMS.INTERVAL.CERT}|Interval for certificate data retrieval.|1h|Text macro|
|{$PVE.PARAMS.INTERVAL.CLUSTER}|Interval for cluster data retrieval.|1m|Text macro|
|{$PVE.PARAMS.INTERVAL.DISK}|Interval for disk discovery.|1h|Text macro|
|{$PVE.PARAMS.INTERVAL.NODE}|Interval for node data retrieval.|1m|Text macro|
|{$PVE.PARAMS.INTERVAL.QEMU.FS}|Interval for QEMU virtual machine filesystem discover.|1h|Text macro|
|{$PVE.PARAMS.INTERVAL.QEMU.NETWORK}|Interval for QEMU virtual machine network interface discovery.|12h|Text macro|
|{$PVE.PARAMS.INTERVAL.QEMU.OS}|Interval for QEMU virtual machine OS metric data retrieval.|12h|Text macro|
|{$PVE.PARAMS.INTERVAL.STORAGE}|Interval for storage discovery.|12h|Text macro|
|{$PVE.PARAMS.INTERVAL.USER}|Interval for user data retrieval.|1h|Text macro|
|{$PVE.PROXY}|Proxy settings for the Proxmox VE API.||Text macro|
|{$PVE.TOKEN.ID}|API tokens allow stateless access to most parts of the REST API by another system, software or API client.|USER@REALM!TOKENID|Text macro|
|{$PVE.TOKEN.SECRET}|Secret key.|`****`|Secret macro|
|{$PVE.TRIGGER.CPU.WARNING}|Threshold for CPU utilization warning triggers in percentage. This macro support context.|90|Text macro|
|{$PVE.TRIGGER.DISK.WARNING}|Threshold for disk usage warning triggers in percentage. This macro support context.|90|Text macro|
|{$PVE.TRIGGER.MEMORY.WARNING}|Threshold for memory usage warning triggers in percentage. This macro support context.|90|Text macro|
|{$PVE.TRIGGER.SWAP.WARNING}|Threshold for swap usage warning triggers in percentage. This macro support context.|90|Text macro|
|{$PVE.TRIGGER.UPTIME}|Threshold for uptime triggers. This macro support context.|15m|Text macro|
|{$PVE.URL.HOST}|The hostname or IP address of the Proxmox VE API host.||Text macro|
|{$PVE.URL.PORT}|The port number of the Proxmox VE API host.|8006|Text macro|

## Items collected

|Name|Description|Type|Key and additional info|
|----|-----------|----|-----------------------|
|Cluster: Number of CPUs|Retrieves the total number of CPUs in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.cpu.count|
|Cluster: CPU utilization|Retrieves the CPU utilization percentage for the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.cpu.utilization|
|Cluster: Number of running LXC containers|Retrieves the number of running LXC containers in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.lxc.running|
|Cluster: Number of stopped LXC containers|Retrieves the number of stopped LXC containers in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.lxc.stopped|
|Cluster: Memory total|Retrieves the total memory available in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.memory.total|
|Cluster: Memory used|Retrieves the total memory used in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.memory.used|
|Cluster: Memory utilization|Retrieves the memory utilization percentage for the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.memory.utilization|
|Cluster: Number of cluster nodes|Retrieves the number of nodes in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.nodes|
|Cluster: Number of cluster nodes offline|Retrieves the number of offline nodes in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.nodes.offline|
|Cluster: Number of cluster nodes online|Retrieves the number of online nodes in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.nodes.online|
|Cluster: Quorum status|Retrieves the cluster quorum status from the Proxmox VE API.|`Dependent item`|proxmox_ve.cluster.quorum.status|
|Cluster: Get resources|Retrieves the list of cluster resources from the Proxmox VE API.|`Script`|proxmox_ve.cluster.resources.get<p>Update: {$PVE.PARAMS.INTERVAL.CLUSTER}</p>|
|Cluster: Storage total|Retrieves the total storage available in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.storage.total|
|Cluster: Storage used|Retrieves the total storage used in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.storage.used|
|Cluster: Storage utilization|Retrieves the storage utilization percentage for the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.storage.utilization|
|Cluster: Number of running virtual machines|Retrieves the number of running virtual machines in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.vms.running|
|Cluster: Number of stopped virtual machines|Retrieves the number of stopped virtual machines in the Proxmox VE cluster.|`Dependent item`|proxmox_ve.cluster.vms.stopped|
|Cluster: Get node data|Retrieves the list of nodes from the Proxmox VE API.|`HTTP agent`|proxmox_ve.get_node_data<p>Update: {$PVE.PARAMS.INTERVAL.NODE}</p>|
|Cluster: Get user data|Retrieves the list of users from the Proxmox VE API.|`HTTP agent`|proxmox_ve.get_user_data<p>Update: {$PVE.PARAMS.INTERVAL.USER}</p>|

## Triggers

|Name|Description|Expression|Severity|Additional info|
|----|-----------|----------|--------|---------------|
|Proxmox VE: Cluster quorum status changed|No majority of nodes for decision making.|`last(/Proxmox VE by HTTP/proxmox_ve.cluster.quorum.status) = 0`|Warning|Manual close: YES|
|Proxmox VE: Cluster resources update error|An error occurred while retrieving cluster resources from the Proxmox VE API.|`jsonpath(last(/Proxmox VE by HTTP/proxmox_ve.cluster.resources.get), "$.status") <> 0 or jsonpath(last(/Proxmox VE by HTTP/proxmox_ve.cluster.resources.get), "$.message") <> ""`|High|-|

## Discovery rules

|Name|Item prototypes|Trigger prototypes|
|----|---------------|------------------|
|Node [{#NODE.NAME}]: Certificate discovery|97|30|
|Node [{#NODE.NAME}]: Disks discovery|97|30|
|Proxmox LXC discovery|97|30|
|Proxmox QEMU discovery|97|30|
|Node [{#NODE.NAME}]: QEMU [{#QEMU.NAME}]: Filesystem discovery|97|30|
|Node [{#NODE.NAME}]: QEMU [{#QEMU.NAME}]: Network interfaces discovery|97|30|
|Node [{#NODE.NAME}]: QEMU [{#QEMU.NAME}][{#QEMU.NETIF.NAME}]: IP addresses discovery|97|30|
|Node [{#NODE.NAME}]: QEMU [{#QEMU.NAME}]: OS info discovery|97|30|
|Node [{#NODE.NAME}]: Storage discovery|97|30|
|Proxmox nodes discovery|97|30|
|Proxmox shared storage discovery|97|30|
|Proxmox users discovery|97|30|

## Template links

There are no template links in this template.

## Feedback

Please report any issues with the template at the [Zabbix community templates repository](https://github.com/zabbix/community-templates/issues).
