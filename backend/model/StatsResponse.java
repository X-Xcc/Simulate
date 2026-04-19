package com.yolov8.security.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class StatsResponse {
    
    private int totalDetections;
    private int totalImages;
    private BehaviorCounts behaviorCounts;
    private List<DetectionData> allDetections;
    private List<DetectionData> recentDetections;

    // Constructor
    public StatsResponse() {
    }

    public StatsResponse(int totalDetections, int totalImages, BehaviorCounts behaviorCounts, List<DetectionData> allDetections, List<DetectionData> recentDetections) {
        this.totalDetections = totalDetections;
        this.totalImages = totalImages;
        this.behaviorCounts = behaviorCounts;
        this.allDetections = allDetections;
        this.recentDetections = recentDetections;
    }

    // Getters
    public int getTotalDetections() {
        return totalDetections;
    }
    public int getTotalImages() {
        return totalImages;
    }
    public BehaviorCounts getBehaviorCounts() {
        return behaviorCounts;
    }
    public List<DetectionData> getAllDetections() {
        return allDetections;
    }
    public List<DetectionData> getRecentDetections() {
        return recentDetections;
    }

    // Setters
    public void setTotalDetections(int totalDetections) {
        this.totalDetections = totalDetections;
    }
    public void setTotalImages(int totalImages) {
        this.totalImages = totalImages;
    }
    public void setBehaviorCounts(BehaviorCounts behaviorCounts) {
        this.behaviorCounts = behaviorCounts;
    }
    public void setAllDetections(List<DetectionData> allDetections) {
        this.allDetections = allDetections;
    }
    public void setRecentDetections(List<DetectionData> recentDetections) {
        this.recentDetections = recentDetections;
    }

    public static class BehaviorCounts {
        private int 跌倒;
        private int 打架;
        private int 离岗;
        private int 疲劳;

        // Constructor
        public BehaviorCounts() {
        }

        public BehaviorCounts(int 跌倒, int 打架, int 离岗, int 疲劳) {
            this.跌倒 = 跌倒;
            this.打架 = 打架;
            this.离岗 = 离岗;
            this.疲劳 = 疲劳;
        }

        // Getters
        public int get跌倒() {
            return 跌倒;
        }
        public int get打架() {
            return 打架;
        }
        public int get离岗() {
            return 离岗;
        }
        public int get疲劳() {
            return 疲劳;
        }

        // Setters
        public void set跌倒(int 跌倒) {
            this.跌倒 = 跌倒;
        }
        public void set打架(int 打架) {
            this.打架 = 打架;
        }
        public void set离岗(int 离岗) {
            this.离岗 = 离岗;
        }
        public void set疲劳(int 疲劳) {
            this.疲劳 = 疲劳;
        }
    }
}
