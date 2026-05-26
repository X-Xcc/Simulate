@RestController@RequestMapping("/api/dashboard")
publicclassDashboardController{
    @AutowiredprivateAlertDataMapperalertMapper;
    @AutowiredprivateRedisTemplateredisTemplate;

    
    @GetMapping("/metrics")
    public ResponseEntity<Map<String,Object>>getDashboardMetrics(){
    Map<String,Object>dataHub=newHashMap();
        intactiveAlerts=alertMapper.selectCountByCurrentWeek();
        doublemodelDelay=(double)redisTemplate.opsForValue().get("ai:model:latency");
        dataHub.put("totalAlerts",activeAlerts);
        dataHub.put("avgDelay",modelDelay+"ms");
        dataHub.put("sysLoad",SystemMonitor.getHardwareCpuLoad()+"%");
        dataHub.put("areaDistribution",alertMapper.groupByPrisonArea());
        dataHub.put("weeklyTrend",alertMapper.selectWeeklyTrendSeries());
        dataHub.put("behaviorRadar",alertMapper.countBehaviorTypeDistribution());23
        returnResponseEntity.ok(dataHub);
    }
}
