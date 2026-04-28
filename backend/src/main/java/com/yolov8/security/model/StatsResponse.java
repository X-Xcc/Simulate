package com.yolov8.security.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class StatsResponse {

    private int totalDetections;
    private int totalImages;
    private BehaviorCounts behaviorCounts;
    private List<DetectionData> allDetections;
    private List<DetectionData> recentDetections;

    public StatsResponse() {
    }

    public StatsResponse(int totalDetections, int totalImages, BehaviorCounts behaviorCounts,
                         List<DetectionData> allDetections, List<DetectionData> recentDetections) {
        this.totalDetections = totalDetections;
        this.totalImages = totalImages;
        this.behaviorCounts = behaviorCounts;
        this.allDetections = allDetections;
        this.recentDetections = recentDetections;
    }

    public int getTotalDetections() { return totalDetections; }
    public int getTotalImages() { return totalImages; }
    public BehaviorCounts getBehaviorCounts() { return behaviorCounts; }
    public List<DetectionData> getAllDetections() { return allDetections; }
    public List<DetectionData> getRecentDetections() { return recentDetections; }

    public void setTotalDetections(int totalDetections) { this.totalDetections = totalDetections; }
    public void setTotalImages(int totalImages) { this.totalImages = totalImages; }
    public void setBehaviorCounts(BehaviorCounts behaviorCounts) { this.behaviorCounts = behaviorCounts; }
    public void setAllDetections(List<DetectionData> allDetections) { this.allDetections = allDetections; }
    public void setRecentDetections(List<DetectionData> recentDetections) { this.recentDetections = recentDetections; }

    public static class BehaviorCounts {
        @JsonProperty("跌倒")
        private int fall;
        @JsonProperty("打架")
        private int fight;
        @JsonProperty("离岗")
        private int absent;
        @JsonProperty("疲劳")
        private int fatigue;
        @JsonProperty("人员聚集")
        private int gather;

        public BehaviorCounts() {
        }

        public BehaviorCounts(int fall, int fight, int absent, int fatigue, int gather) {
            this.fall = fall;
            this.fight = fight;
            this.absent = absent;
            this.fatigue = fatigue;
            this.gather = gather;
        }

        public int getFall() { return fall; }
        public int getFight() { return fight; }
        public int getAbsent() { return absent; }
        public int getFatigue() { return fatigue; }
        public int getGather() { return gather; }

        public void setFall(int fall) { this.fall = fall; }
        public void setFight(int fight) { this.fight = fight; }
        public void setAbsent(int absent) { this.absent = absent; }
        public void setFatigue(int fatigue) { this.fatigue = fatigue; }
        public void setGather(int gather) { this.gather = gather; }

        @JsonProperty("跌倒")
        public int get跌倒() { return fall; }
        @JsonProperty("打架")
        public int get打架() { return fight; }
        @JsonProperty("离岗")
        public int get离岗() { return absent; }
        @JsonProperty("疲劳")
        public int get疲劳() { return fatigue; }
        @JsonProperty("人员聚集")
        public int get人员聚集() { return gather; }

        @JsonProperty("跌倒")
        public void set跌倒(int fall) { this.fall = fall; }
        @JsonProperty("打架")
        public void set打架(int fight) { this.fight = fight; }
        @JsonProperty("离岗")
        public void set离岗(int absent) { this.absent = absent; }
        @JsonProperty("疲劳")
        public void set疲劳(int fatigue) { this.fatigue = fatigue; }
        @JsonProperty("人员聚集")
        public void set人员聚集(int gather) { this.gather = gather; }
    }
}
