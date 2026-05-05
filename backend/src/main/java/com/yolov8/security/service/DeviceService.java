package com.yolov8.security.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.util.List;
import java.util.Set;

@Service
public class DeviceService extends AbstractJsonFileService<DeviceService.Device> {

    private static final Set<String> VALID_TYPES = Set.of("camera", "sensor", "alarm");

    public DeviceService(AppConfig appConfig, ObjectMapper objectMapper) {
        super(Paths.get(appConfig.getFile().getUploadDir()).resolve("devices.json"), objectMapper);
    }

    @Override
    protected TypeReference<List<Device>> typeRef() {
        return new TypeReference<>() {};
    }

    public List<Device> getAllDevices() {
        lock.readLock().lock();
        try {
            return readConfig();
        } finally {
            lock.readLock().unlock();
        }
    }

    public Device addDevice(Device device) {
        lock.writeLock().lock();
        try {
            validate(device);
            List<Device> devices = readConfig();

            if (device.getId() != null && !device.getId().isEmpty()) {
                boolean duplicate = devices.stream().anyMatch(d -> d.getId().equals(device.getId()));
                if (duplicate) {
                    throw new IllegalArgumentException("设备ID已存在: " + device.getId());
                }
            } else {
                device.setId(generateId(devices));
            }

            devices.add(device);
            writeConfig(devices);
            return device;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public Device updateDevice(String id, Device update) {
        lock.writeLock().lock();
        try {
            validate(update);
            List<Device> devices = readConfig();

            int index = -1;
            for (int i = 0; i < devices.size(); i++) {
                if (devices.get(i).getId().equals(id)) {
                    index = i;
                    break;
                }
            }
            if (index == -1) {
                throw new IllegalArgumentException("设备不存在: " + id);
            }

            update.setId(id);
            devices.set(index, update);
            writeConfig(devices);
            return update;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public boolean deleteDevice(String id) {
        lock.writeLock().lock();
        try {
            List<Device> devices = readConfig();
            boolean removed = devices.removeIf(d -> d.getId().equals(id));
            if (removed) {
                writeConfig(devices);
            }
            return removed;
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void validate(Device device) {
        if (device.getName() == null || device.getName().isEmpty()) {
            throw new IllegalArgumentException("设备名称不能为空");
        }
        if (device.getType() == null || !VALID_TYPES.contains(device.getType())) {
            throw new IllegalArgumentException("设备类型必须是 camera、sensor 或 alarm");
        }
        if (device.getAddress() == null || device.getAddress().isEmpty()) {
            throw new IllegalArgumentException("设备地址不能为空");
        }
    }

    private String generateId(List<Device> devices) {
        int maxNum = -1;
        for (Device d : devices) {
            String id = d.getId();
            if (id != null && id.startsWith("dev")) {
                try {
                    int num = Integer.parseInt(id.substring(3));
                    if (num > maxNum) maxNum = num;
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return "dev" + (maxNum + 1);
    }

    public static class Device {
        private String id;
        private String name;
        private String type;
        private String address;
        private String status;
        private String location;

        public Device() {}

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }
    }
}
