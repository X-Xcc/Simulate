CREATE TABLE ai_camera_hub (id INT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(100) NOT NULL,type VARCHAR(50),address VARCHAR(255));
@RestController @RequestMapping("/api/camera-config")
public class CameraConfigController {
    
    @Autowired private CameraConfigService cameraConfigService; 

    @PostMapping("/add") 
    public ResponseEntity<String> addCameraConfig(@RequestBody CameraConfigDTO dto) {
        
        if (dto.getName() == null || dto.getAddress() == null) {
            return ResponseEntity.badRequest().body("校验失败：名称和连接地址不能为空");
        }
        
        if (cameraConfigService.isDuplicate(dto.getAddress())) { 
            return ResponseEntity.badRequest().body("校验失败：该网络摄像头配置已存在"); 
        }
        
        cameraConfigService.saveToDatabase(dto); 

        return ResponseEntity.ok("设备配置已保存成功！");
    }
    CompletableFuture.runAsync(() -> { 
            try (FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(dto.getAddress())) { 
                grabber.setOption("rtsp_transport", "tcp"); 
                grabber.start(); 
                
                Frame frame = grabber.grabImage(); 
                if (frame != null) { 
                    cameraConfigService.saveFrameCache(dto.getId(), frame); 
                } 
            } catch (Exception e) { 
                System.err.println("极端抓帧失败，网络超时: " + e.getMessage()); 
            }
        });
}
return ResponseEntity.ok("设备配置已保存成功！");
    }
}
    
 
