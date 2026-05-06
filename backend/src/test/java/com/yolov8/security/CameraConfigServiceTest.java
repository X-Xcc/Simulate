package com.yolov8.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yolov8.security.config.AppConfig;
import com.yolov8.security.service.CameraConfigService;
import com.yolov8.security.service.CameraConfigService.Camera;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CameraConfigServiceTest {

    @TempDir
    Path tempDir;

    private CameraConfigService service;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() throws IOException {
        objectMapper = new ObjectMapper();

        // Create a dummy script file so getParent() resolves to tempDir
        Path scriptPath = tempDir.resolve("yolov8_security.py");
        Files.writeString(scriptPath, "# dummy");

        AppConfig appConfig = new AppConfig();
        AppConfig.PythonConfig pythonConfig = new AppConfig.PythonConfig();
        pythonConfig.setScriptPath(scriptPath.toString());
        appConfig.setPython(pythonConfig);

        service = new CameraConfigService(appConfig, objectMapper);
    }

    private void writeCamerasJson(String json) throws IOException {
        Files.writeString(tempDir.resolve("cameras.json"), json);
    }

    // --- Read tests ---

    @Test
    void getAllCameras_missingFile_returnsEmpty() {
        List<Camera> result = service.getAllCameras();
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void getAllCameras_validFile_parses() throws IOException {
        writeCamerasJson("""
            {"cameras": [
                {"id": "cam0", "type": "usb", "address": 0, "name": "主摄像头"},
                {"id": "cam1", "type": "rtsp", "address": "rtsp://10.0.0.1:554/s1", "name": "走廊"}
            ]}
        """);
        List<Camera> result = service.getAllCameras();
        assertEquals(2, result.size());
        assertEquals("cam0", result.get(0).getId());
        assertEquals("usb", result.get(0).getType());
        assertEquals(0, result.get(0).getAddress());
        assertEquals("rtsp", result.get(1).getType());
        assertEquals("rtsp://10.0.0.1:554/s1", result.get(1).getAddress());
    }

    @Test
    void getAllCameras_invalidJson_returnsEmpty() throws IOException {
        writeCamerasJson("not valid json{{{");
        List<Camera> result = service.getAllCameras();
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void getCameraById_existingId_returnsCamera() throws IOException {
        writeCamerasJson("""
            {"cameras": [{"id": "cam0", "type": "usb", "address": 0, "name": "主"}]}
        """);
        Camera result = service.getCameraById("cam0");
        assertNotNull(result);
        assertEquals("cam0", result.getId());
    }

    @Test
    void getCameraById_nonExisting_returnsNull() throws IOException {
        writeCamerasJson("""
            {"cameras": [{"id": "cam0", "type": "usb", "address": 0, "name": "主"}]}
        """);
        Camera result = service.getCameraById("cam99");
        assertNull(result);
    }

    // --- Add tests ---

    @Test
    void addCamera_usbCamera_succeeds() {
        Camera cam = new Camera();
        cam.setType("usb");
        cam.setAddress(0);
        cam.setName("USB摄像头");

        Camera result = service.addCamera(cam);
        assertNotNull(result.getId());
        assertEquals("cam0", result.getId());
        assertEquals("usb", result.getType());

        // Verify persisted
        List<Camera> all = service.getAllCameras();
        assertEquals(1, all.size());
    }

    @Test
    void addCamera_rtspCamera_succeeds() {
        Camera cam = new Camera();
        cam.setType("rtsp");
        cam.setAddress("rtsp://192.168.1.1:554/stream1");
        cam.setName("RTSP摄像头");

        Camera result = service.addCamera(cam);
        assertEquals("cam0", result.getId());

        // Verify file content
        List<Camera> all = service.getAllCameras();
        assertEquals(1, all.size());
        assertEquals("rtsp://192.168.1.1:554/stream1", all.get(0).getAddress());
    }

    @Test
    void addCamera_autoGeneratesIncrementalId() {
        Camera cam1 = new Camera();
        cam1.setType("usb"); cam1.setAddress(0); cam1.setName("A");
        service.addCamera(cam1);

        Camera cam2 = new Camera();
        cam2.setType("usb"); cam2.setAddress(1); cam2.setName("B");
        Camera result = service.addCamera(cam2);

        assertEquals("cam1", result.getId());
    }

    @Test
    void addCamera_duplicateId_throws() {
        Camera cam1 = new Camera();
        cam1.setId("mycam"); cam1.setType("usb"); cam1.setAddress(0); cam1.setName("A");
        service.addCamera(cam1);

        Camera cam2 = new Camera();
        cam2.setId("mycam"); cam2.setType("usb"); cam2.setAddress(1); cam2.setName("B");
        assertThrows(IllegalArgumentException.class, () -> service.addCamera(cam2));
    }

    @Test
    void addCamera_invalidType_throws() {
        Camera cam = new Camera();
        cam.setType("invalid"); cam.setAddress(0); cam.setName("X");
        assertThrows(IllegalArgumentException.class, () -> service.addCamera(cam));
    }

    @Test
    void addCamera_missingName_throws() {
        Camera cam = new Camera();
        cam.setType("usb"); cam.setAddress(0);
        assertThrows(IllegalArgumentException.class, () -> service.addCamera(cam));
    }

    @Test
    void addCamera_usbWithStringAddress_throws() {
        Camera cam = new Camera();
        cam.setType("usb"); cam.setAddress("not_a_number"); cam.setName("X");
        assertThrows(IllegalArgumentException.class, () -> service.addCamera(cam));
    }

    // --- Update tests ---

    @Test
    void updateCamera_existingId_updates() throws IOException {
        writeCamerasJson("""
            {"cameras": [{"id": "cam0", "type": "usb", "address": 0, "name": "旧名称"}]}
        """);

        Camera update = new Camera();
        update.setType("usb"); update.setAddress(0); update.setName("新名称");
        Camera result = service.updateCamera("cam0", update);

        assertEquals("cam0", result.getId());
        assertEquals("新名称", result.getName());

        // Verify persisted
        assertEquals("新名称", service.getCameraById("cam0").getName());
    }

    @Test
    void updateCamera_nonExisting_throws() {
        Camera update = new Camera();
        update.setType("usb"); update.setAddress(0); update.setName("X");
        assertThrows(IllegalArgumentException.class, () -> service.updateCamera("cam99", update));
    }

    // --- Delete tests ---

    @Test
    void deleteCamera_existingId_deletes() throws IOException {
        writeCamerasJson("""
            {"cameras": [
                {"id": "cam0", "type": "usb", "address": 0, "name": "A"},
                {"id": "cam1", "type": "usb", "address": 1, "name": "B"}
            ]}
        """);

        boolean result = service.deleteCamera("cam0");
        assertTrue(result);

        List<Camera> all = service.getAllCameras();
        assertEquals(1, all.size());
        assertEquals("cam1", all.get(0).getId());
    }

    @Test
    void deleteCamera_nonExisting_returnsFalse() throws IOException {
        writeCamerasJson("""
            {"cameras": [{"id": "cam0", "type": "usb", "address": 0, "name": "A"}]}
        """);

        boolean result = service.deleteCamera("cam99");
        assertFalse(result);
        assertEquals(1, service.getAllCameras().size());
    }

    @Test
    void deleteCamera_missingFile_returnsFalse() {
        boolean result = service.deleteCamera("cam0");
        assertFalse(result);
    }
}
