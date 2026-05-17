package com.yolov8.security.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

@Service
public class OnvifDiscoveryService {

    private static final Logger log = LoggerFactory.getLogger(OnvifDiscoveryService.class);

    private static final String MULTICAST_ADDR = "239.255.255.250";
    private static final int MULTICAST_PORT = 3702;
    private static final int TIMEOUT_MS = 3000;

    public List<DiscoveredCamera> discover() {
        List<DiscoveredCamera> results = new CopyOnWriteArrayList<>();

        String probe = buildProbeMessage();

        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setSoTimeout(TIMEOUT_MS);

            InetAddress group = InetAddress.getByName(MULTICAST_ADDR);
            byte[] data = probe.getBytes(StandardCharsets.UTF_8);
            DatagramPacket packet = new DatagramPacket(data, data.length, group, MULTICAST_PORT);
            socket.send(packet);

            long deadline = System.currentTimeMillis() + TIMEOUT_MS;
            byte[] buf = new byte[8192];

            while (System.currentTimeMillis() < deadline) {
                try {
                    DatagramPacket recv = new DatagramPacket(buf, buf.length);
                    socket.receive(recv);
                    String response = new String(recv.getData(), 0, recv.getLength(), StandardCharsets.UTF_8);
                    DiscoveredCamera camera = parseResponse(response, recv.getAddress().getHostAddress());
                    if (camera != null) {
                        boolean duplicate = results.stream().anyMatch(c -> c.ip.equals(camera.ip));
                        if (!duplicate) {
                            results.add(camera);
                            log.info("发现摄像头: {} ({})", camera.ip, camera.brand);
                        }
                    }
                } catch (SocketTimeoutException e) {
                    break;
                }
            }
        } catch (Exception e) {
            log.error("ONVIF 扫描失败", e);
        }

        return results;
    }

    private String buildProbeMessage() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            + "<e:Envelope xmlns:e=\"http://www.w3.org/2003/05/soap-envelope\""
            + " xmlns:w=\"http://schemas.xmlsoap.org/ws/2004/08/addressing\""
            + " xmlns:d=\"http://schemas.xmlsoap.org/ws/2005/04/discovery\">"
            + "<e:Header>"
            + "<w:MessageID>uuid:" + UUID.randomUUID() + "</w:MessageID>"
            + "<w:To e:mustUnderstand=\"true\">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>"
            + "<w:Action e:mustUnderstand=\"true\">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>"
            + "</e:Header>"
            + "<e:Body>"
            + "<d:Probe>"
            + "<d:Types>dn:NetworkVideoTransmitter</d:Types>"
            + "</d:Probe>"
            + "</e:Body>"
            + "</e:Envelope>";
    }

    private DiscoveredCamera parseResponse(String xml, String ip) {
        try {
            DiscoveredCamera camera = new DiscoveredCamera();
            camera.ip = ip;

            String xaddr = extractTag(xml, "XAddrs");
            if (xaddr != null && !xaddr.isEmpty()) {
                camera.serviceUrl = xaddr.trim().split("\\s+")[0];
            }

            String scopes = extractTag(xml, "Scopes");
            if (scopes != null) {
                camera.brand = extractScope(scopes, "hardware/");
                camera.model = extractScope(scopes, "model/");
                camera.name = extractScope(scopes, "name/");
            }

            if (camera.name == null || camera.name.isEmpty()) {
                camera.name = "ONVIF Camera (" + ip + ")";
            }

            camera.rtspUrl = "rtsp://" + ip + ":554/Streaming/Channels/101";

            return camera;
        } catch (Exception e) {
            log.debug("解析 ONVIF 响应失败: {}", e.getMessage());
            return null;
        }
    }

    private String extractTag(String xml, String tag) {
        int start = xml.indexOf("<" + tag);
        if (start == -1) return null;
        start = xml.indexOf(">", start) + 1;
        int end = xml.indexOf("</" + tag + ">", start);
        if (end == -1) return null;
        return xml.substring(start, end).trim();
    }

    private String extractScope(String scopes, String prefix) {
        for (String scope : scopes.split("\\s+")) {
            if (scope.contains(prefix)) {
                int idx = scope.indexOf(prefix);
                String value = scope.substring(idx + prefix.length());
                if (value.endsWith("/")) value = value.substring(0, value.length() - 1);
                return value;
            }
        }
        return null;
    }

    public static class DiscoveredCamera {
        public String ip;
        public String name;
        public String brand;
        public String model;
        public String rtspUrl;
        public String serviceUrl;

        @Override
        public String toString() {
            return "DiscoveredCamera{ip='" + ip + "', brand='" + brand + "', model='" + model + "'}";
        }
    }
}
