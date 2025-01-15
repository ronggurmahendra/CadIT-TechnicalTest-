const fs = require('fs');
const path = require('path');
const express = require('express');

// A/P/Q is only calculated when production occurs. You can skip the average for days without 
// production in multi-day calculations and also exclude calculations for equipment that had no 
// production. Example:
const hasProduction = (productionData) => {
    return productionData.some(entry => entry.actual_quantity > 0);
};

const hasRunningStatusForDay = (statusData, date) => {
    return statusData.some(entry => {
        const entryDate = new Date(entry.Start_Time).toDateString();
        return entryDate === date && entry.Status === "RUNNING";
    });
};
const calculateAvailability = (statusData, productionData) => {
    // A = (RUNNING + IDLE) / TOTAL

    if (!productionData || productionData.length === 0) return 0;

    let runningTime = 0;
    let idleTime = 0;
    let downTime = 0;

    const getOverlappingDuration = (statusStart, statusEnd, prodStart, prodEnd) => {
        const overlapStart = Math.max(statusStart, prodStart);
        const overlapEnd = Math.min(statusEnd, prodEnd);
        return Math.max(0, overlapEnd - overlapStart);
    };

    // Iterate over status data to calculate time overlaps with production periods
    statusData.forEach(entry => {
        const statusStart = new Date(entry.Start_Time).getTime();
        const statusEnd = new Date(entry.End_Time).getTime();

        productionData.forEach(prodEntry => {
            const prodStart = new Date(prodEntry.start_production).getTime();
            const prodEnd = new Date(prodEntry.finish_production).getTime();

            const overlappingDuration = getOverlappingDuration(
                statusStart,
                statusEnd,
                prodStart,
                prodEnd
            );
            // console.log(statusStart,statusEnd, prodStart, prodEnd)
            if (overlappingDuration > 0) {
                const durationInSeconds = overlappingDuration / 1000; // Convert to seconds

                if (entry.Status === "RUNNING") {
                    runningTime += durationInSeconds;
                } else if (entry.Status === "IDLE") {
                    idleTime += durationInSeconds;
                } else if (entry.Status === "DOWN") {
                    downTime += durationInSeconds;
                }
            }
        });
    });

    const totalTime = runningTime + idleTime + downTime;
    return totalTime > 0 ? (runningTime + idleTime) / totalTime : 0;
};


// Calculate Performance
const calculatePerformance = (statusData, productionData) => {
    // P = IDEAL CYCLE TIME / ACTUAL CYCLE TIME
    // IDEAL CYCLE TIME  = PLANNED DURATION/PLANNED QUANTITY
    // ACTUAL CYCLE TIME  = ACTUAL DURATION/ACTUAL QUANTITY
    if (!hasProduction(productionData)) return 0;

    let plannedDuration = 0;
    let plannedQuantity = 0;
    let actualDuration = 0;
    let actualQuantity = 0;

    productionData.forEach(entry => {
        plannedDuration += entry.planned_duration_in_second;
        plannedQuantity += entry.planned_quantity;

        const start = new Date(entry.start_production);
        const end = new Date(entry.finish_production);
        actualDuration += (end - start) / 1000;

        actualQuantity += entry.actual_quantity;
    });

    const idealCycleTime = plannedQuantity > 0 ? plannedDuration / plannedQuantity : 0;
    const actualCycleTime = actualQuantity > 0 ? actualDuration / actualQuantity : 0;

    let performance = actualCycleTime > 0 ? idealCycleTime / actualCycleTime : 0;
    if (performance > 1) performance = 1;

    return performance;
};

// Calculate Quality
const calculateQuality = (statusData, productionData) => {
    // Q = ACTUAL QUANTIY - TOTAL DEFECT QUANTITY / ACTUAL QUANTITY
    if (!hasProduction(productionData)) return 0;

    let totalActualQuantity = 0;
    let totalDefectQuantity = 0;

    productionData.forEach(entry => {
        totalActualQuantity += entry.actual_quantity;
        totalDefectQuantity += entry.defect_quantity;
    });

    const goodQuantity = totalActualQuantity - totalDefectQuantity;
    return totalActualQuantity > 0 ? goodQuantity / totalActualQuantity : 0;
};

// Calculate OEE
const calculateOEE = (statusData, productionData) => {
    // const uniqueDates = [...new Set(productionData.map(entry => new Date(entry.start_production).toDateString()))];
    // let totalAvailability = 0;
    // let totalPerformance = 0;
    // let totalQuality = 0;
    // let daysWithProduction = 0;

    
    // uniqueDates.forEach(date => {
    //     // make sure the day calck is producing something first
    //     if (hasRunningStatusForDay(statusData, date) && hasProduction(productionData)) {
    //         const dailyStatusData = statusData.filter(entry => new Date(entry.Start_Time).toDateString() === date);
    //         const dailyProductionData = productionData.filter(entry => new Date(entry.start_production).toDateString() === date);

    //         const availability = calculateAvailability(dailyStatusData, dailyProductionData);
    //         const performance = calculatePerformance(dailyStatusData, dailyProductionData);
    //         const quality = calculateQuality(dailyStatusData, dailyProductionData);

    //         totalAvailability += availability;
    //         totalPerformance += performance;
    //         totalQuality += quality;
    //         daysWithProduction++;
    //     }
    // });

    // const averageAvailability = daysWithProduction > 0 ? totalAvailability / daysWithProduction : 0;
    // const averagePerformance = daysWithProduction > 0 ? totalPerformance / daysWithProduction : 0;
    // const averageQuality = daysWithProduction > 0 ? totalQuality / daysWithProduction : 0;

    // const oee = averageAvailability * averagePerformance * averageQuality;
    const availability = calculateAvailability(statusData, productionData);
    const performance = calculatePerformance(statusData, productionData);
    const quality = calculateQuality(statusData, productionData);
    
    const oee = availability * performance * quality
    return {
        availability: availability,
        performance: performance,
        quality: quality,
        oee
    };
};
const categorizeOEE = (oee) => {
    if (0 <= oee && oee <= 0.5) {
        return "Bad";
    } else if (0.5 < oee && oee <= 0.6) {
        return "Minimum";
    } else if (0.6 < oee && oee <= 0.75) {
        return "Good";
    } else if (0.75 < oee && oee <= 0.85) {
        return "Recommended";
    } else if (0.85 < oee && oee <= 1) {
        return "Excellent";
    }
    return "";
};

// Export functions
module.exports = {
    calculateAvailability,
    calculatePerformance,
    calculateQuality,
    calculateOEE,
    categorizeOEE
};
