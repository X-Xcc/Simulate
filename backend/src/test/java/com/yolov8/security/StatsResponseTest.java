package com.yolov8.security;

import com.yolov8.security.model.DetectionData;
import com.yolov8.security.model.StatsResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StatsResponseTest {

    // --- StatsResponse basic field tests ---

    @Test
    void defaultConstructor_createsEmptyResponse() {
        StatsResponse response = new StatsResponse();
        assertEquals(0, response.getTotalDetections());
        assertEquals(0, response.getTotalImages());
        assertNull(response.getBehaviorCounts());
        assertNull(response.getAllDetections());
        assertNull(response.getRecentDetections());
    }

    @Test
    void fullConstructor_setsAllFields() {
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts(1, 2, 3, 4);
        List<DetectionData> all = Collections.singletonList(new DetectionData());
        List<DetectionData> recent = Collections.singletonList(new DetectionData());

        StatsResponse response = new StatsResponse(10, 5, bc, all, recent);

        assertEquals(10, response.getTotalDetections());
        assertEquals(5, response.getTotalImages());
        assertSame(bc, response.getBehaviorCounts());
        assertSame(all, response.getAllDetections());
        assertSame(recent, response.getRecentDetections());
    }

    @Test
    void setters_overrideFields() {
        StatsResponse response = new StatsResponse();
        response.setTotalDetections(42);
        response.setTotalImages(7);
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts();
        response.setBehaviorCounts(bc);
        List<DetectionData> list = Collections.emptyList();
        response.setAllDetections(list);
        response.setRecentDetections(list);

        assertEquals(42, response.getTotalDetections());
        assertEquals(7, response.getTotalImages());
        assertSame(bc, response.getBehaviorCounts());
        assertSame(list, response.getAllDetections());
        assertSame(list, response.getRecentDetections());
    }

    // --- BehaviorCounts tests ---

    @Test
    void behaviorCounts_defaultConstructor_allZeros() {
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts();
        assertEquals(0, bc.getFall());
        assertEquals(0, bc.getFight());
        assertEquals(0, bc.getAbsent());
        assertEquals(0, bc.getFatigue());
    }

    @Test
    void behaviorCounts_fullConstructor_setsValues() {
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts(5, 3, 2, 1);
        assertEquals(5, bc.getFall());
        assertEquals(3, bc.getFight());
        assertEquals(2, bc.getAbsent());
        assertEquals(1, bc.getFatigue());
    }

    @Test
    void behaviorCounts_setters_updateIndividualFields() {
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts();
        bc.setFall(10);
        bc.setFight(20);
        bc.setAbsent(30);
        bc.setFatigue(40);

        assertEquals(10, bc.getFall());
        assertEquals(20, bc.getFight());
        assertEquals(30, bc.getAbsent());
        assertEquals(40, bc.getFatigue());
    }

    @Test
    void behaviorCounts_chineseGettersMirrorEnglishOnes() {
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts(7, 6, 5, 4);

        // Chinese-named getters should return the same values as English ones
        assertEquals(bc.getFall(), bc.get跌倒());
        assertEquals(bc.getFight(), bc.get打架());
        assertEquals(bc.getAbsent(), bc.get离岗());
        assertEquals(bc.getFatigue(), bc.get疲劳());
    }

    @Test
    void behaviorCounts_chineseSettersMirrorEnglishOnes() {
        StatsResponse.BehaviorCounts bc = new StatsResponse.BehaviorCounts();
        bc.set跌倒(100);
        bc.set打架(200);
        bc.set离岗(300);
        bc.set疲劳(400);

        assertEquals(100, bc.getFall());
        assertEquals(200, bc.getFight());
        assertEquals(300, bc.getAbsent());
        assertEquals(400, bc.getFatigue());
    }
}
