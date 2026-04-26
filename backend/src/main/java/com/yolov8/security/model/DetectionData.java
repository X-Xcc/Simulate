package com.yolov8.security.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class DetectionData {

    private String id;
    private String timestamp;
    private List<String> actions;

    @JsonProperty("person_count")
    private int personCount;

    private String filename;

    @JsonProperty("image_filename")
    private String imageFilename;

    private List<Map<String, Object>> boxes;

    public DetectionData() {
    }

    public DetectionData(String id, String timestamp, List<String> actions, int personCount,
                         String filename, String imageFilename, List<Map<String, Object>> boxes) {
        this.id = id;
        this.timestamp = timestamp;
        this.actions = actions;
        this.personCount = personCount;
        this.filename = filename;
        this.imageFilename = imageFilename;
        this.boxes = boxes;
    }

    public String getId() { return id; }
    public String getTimestamp() { return timestamp; }
    public List<String> getActions() { return actions; }
    public int getPersonCount() { return personCount; }
    public String getFilename() { return filename; }
    public String getImageFilename() { return imageFilename; }
    public List<Map<String, Object>> getBoxes() { return boxes; }

    public void setId(String id) { this.id = id; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public void setActions(List<String> actions) { this.actions = actions; }
    public void setPersonCount(int personCount) { this.personCount = personCount; }
    public void setFilename(String filename) { this.filename = filename; }
    public void setImageFilename(String imageFilename) { this.imageFilename = imageFilename; }
    public void setBoxes(List<Map<String, Object>> boxes) { this.boxes = boxes; }
}
