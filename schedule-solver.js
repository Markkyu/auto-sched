/**
 * ScheduleSolver class for university course scheduling
 * A CSP-inspired approach to scheduling courses with constraints
 */
class ScheduleSolver {
    constructor() {
        this.courses = [];
        this.timeSlots = ["8:00", "9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
        this.days = ["mon", "tue", "wed", "thu", "fri"];
        // Group days according to common patterns
        this.dayPatterns = {
            "MWF": ["mon", "wed", "fri"],
            "TTh": ["tue", "thu"],
            "any": this.days
        };
    }

    /**
     * Add a course to be scheduled
     * @param {string} code - Course code (e.g., CS101)
     * @param {string} name - Course name
     * @param {string} teacher - Teacher name
     * @param {number} hours - Hours per week (1-10)
     * @param {string} preferredDays - Preferred days pattern ('MWF', 'TTh', or 'any')
     * @param {number} priority - Priority level (1-5, where 5 is highest)
     */
    addCourse(code, name, teacher, hours, preferredDays = 'any', priority = 3) {
        this.courses.push({
            code,
            name,
            teacher,
            hours,
            preferredDays,
            priority,
            scheduled: false
        });
    }

    /**
     * Solve the course scheduling problem
     * @returns {Object} Result object with success flag, schedule, and statistics
     */
    solve() {
        // Sort courses by priority (highest first) and hours (highest first)
        this.courses.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return b.hours - a.hours;
        });

        // Initialize empty schedule
        const schedule = {};
        this.days.forEach(day => {
            schedule[day] = {};
            this.timeSlots.forEach(time => {
                schedule[day][time] = [];
            });
        });

        // Track teachers' schedules to avoid conflicts
        const teacherSchedule = {};
        
        // Process each course
        let scheduledCount = 0;
        const totalCount = this.courses.length;
        
        for (const course of this.courses) {
            if (this.scheduleCourse(course, schedule, teacherSchedule)) {
                scheduledCount++;
                course.scheduled = true;
            }
        }

        // If not all courses could be scheduled in the first pass,
        // try again with different strategies
        if (scheduledCount < totalCount) {
            for (const course of this.courses) {
                if (!course.scheduled) {
                    // Try alternative scheduling strategies
                    if (this.scheduleCourseWithRelaxedConstraints(course, schedule, teacherSchedule)) {
                        scheduledCount++;
                        course.scheduled = true;
                    }
                }
            }
        }

        // Return the result
        return {
            success: scheduledCount === totalCount,
            schedule,
            scheduledCount,
            totalCount,
            message: scheduledCount === totalCount 
                ? "All courses scheduled successfully" 
                : `Could not schedule ${totalCount - scheduledCount} courses due to constraints`
        };
    }

    /**
     * Schedule a single course based on its constraints
     * @param {Object} course - Course to schedule
     * @param {Object} schedule - Current schedule
     * @param {Object} teacherSchedule - Current teacher schedule
     * @returns {boolean} True if scheduled successfully
     */
    scheduleCourse(course, schedule, teacherSchedule) {
        // Get available days based on preference
        const availableDays = this.dayPatterns[course.preferredDays] || this.days;
        
        // For courses with > 1 hour, we need to decide scheduling strategy
        let schedulingStrategy;
        
        if (course.hours <= 1) {
            schedulingStrategy = 'single';
        } else if (course.preferredDays === 'MWF' && course.hours === 3) {
            schedulingStrategy = 'mwf';
        } else if (course.preferredDays === 'TTh' && course.hours === 3) {
            schedulingStrategy = 'tth_longer';
        } else if (course.preferredDays === 'TTh' && course.hours <= 2) {
            schedulingStrategy = 'tth';
        } else {
            // Default to distributing evenly
            schedulingStrategy = 'distribute';
        }
        
        return this.applySchedulingStrategy(
            schedulingStrategy, 
            course, 
            schedule, 
            teacherSchedule, 
            availableDays
        );
    }
    
    /**
     * Apply a specific scheduling strategy for a course
     * @param {string} strategy - Strategy name
     * @param {Object} course - Course to schedule
     * @param {Object} schedule - Current schedule
     * @param {Object} teacherSchedule - Current teacher schedule
     * @param {Array} availableDays - Available days for scheduling
     * @returns {boolean} True if scheduled successfully
     */
    applySchedulingStrategy(strategy, course, schedule, teacherSchedule, availableDays) {
        switch (strategy) {
            case 'single':
                // For 1-hour courses, just find any available slot
                return this.scheduleInSingleSlot(course, schedule, teacherSchedule, availableDays);
                
            case 'mwf':
                // Monday-Wednesday-Friday pattern (1 hour each day)
                return this.scheduleMWF(course, schedule, teacherSchedule);
                
            case 'tth':
                // Tuesday-Thursday pattern (1 hour each day)
                return this.scheduleTTh(course, schedule, teacherSchedule);
                
            case 'tth_longer':
                // Tuesday-Thursday pattern (1.5 hours each day)
                return this.scheduleTThLonger(course, schedule, teacherSchedule);
                
            case 'distribute':
                // Distribute hours across available days
                return this.scheduleDistributed(course, schedule, teacherSchedule, availableDays);
                
            default:
                // Default to distributed scheduling
                return this.scheduleDistributed(course, schedule, teacherSchedule, availableDays);
        }
    }
    
    /**
     * Try to schedule a course with relaxed constraints
     * @param {Object} course - Course to schedule
     * @param {Object} schedule - Current schedule
     * @param {Object} teacherSchedule - Current teacher schedule
     * @returns {boolean} True if scheduled successfully
     */
    scheduleCourseWithRelaxedConstraints(course, schedule, teacherSchedule) {
        // Try scheduling on any day, regardless of preference
        return this.scheduleDistributed(course, schedule, teacherSchedule, this.days);
    }
    
    /**
     * Schedule a course in a single time slot
     */
    scheduleInSingleSlot(course, schedule, teacherSchedule, availableDays) {
        for (const time of this.timeSlots) {
            for (const day of availableDays) {
                if (!this.hasConflict(course.teacher, day, time, teacherSchedule)) {
                    this.addToSchedule(course, schedule, teacherSchedule, day, time);
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Schedule a course in Monday-Wednesday-Friday pattern
     */
    scheduleMWF(course, schedule, teacherSchedule) {
        const mwfDays = ["mon", "wed", "fri"];
        
        // Check for available slots at the same time on all three days
        for (const time of this.timeSlots) {
            let available = true;
            
            // Check if all required days are available at this time
            for (const day of mwfDays) {
                if (this.hasConflict(course.teacher, day, time, teacherSchedule)) {
                    available = false;
                    break;
                }
            }
            
            if (available) {
                // Schedule at the same time on all three days
                for (const day of mwfDays) {
                    this.addToSchedule(course, schedule, teacherSchedule, day, time);
                }
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Schedule a course in Tuesday-Thursday pattern
     */
    scheduleTTh(course, schedule, teacherSchedule) {
        const tthDays = ["tue", "thu"];
        
        // Check for available slots at the same time on both days
        for (const time of this.timeSlots) {
            let available = true;
            
            // Check if all required days are available at this time
            for (const day of tthDays) {
                if (this.hasConflict(course.teacher, day, time, teacherSchedule)) {
                    available = false;
                    break;
                }
            }
            
            if (available) {
                // Schedule at the same time on both days
                for (const day of tthDays) {
                    this.addToSchedule(course, schedule, teacherSchedule, day, time);
                }
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Schedule a course in Tuesday-Thursday pattern with longer sessions
     */
    scheduleTThLonger(course, schedule, teacherSchedule) {
        const tthDays = ["tue", "thu"];
        
        // Check for available consecutive slots on both days
        for (let i = 0; i < this.timeSlots.length - 1; i++) {
            const time1 = this.timeSlots[i];
            const time2 = this.timeSlots[i + 1];
            
            let available = true;
            
            // Check if both time slots are available on both days
            for (const day of tthDays) {
                if (this.hasConflict(course.teacher, day, time1, teacherSchedule) || 
                    this.hasConflict(course.teacher, day, time2, teacherSchedule)) {
                    available = false;
                    break;
                }
            }
            
            if (available) {
                // Schedule in consecutive slots on both days
                for (const day of tthDays) {
                    this.addToSchedule(course, schedule, teacherSchedule, day, time1);
                    
                    // For the second hour, modify the course object to show it continues
                    const continuedCourse = { ...course, continued: true };
                    this.addToSchedule(continuedCourse, schedule, teacherSchedule, day, time2);
                }
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Schedule a course distributed across available days
     */
    scheduleDistributed(course, schedule, teacherSchedule, availableDays) {
        let remainingHours = course.hours;
        const scheduledSlots = [];
        
        // Try to distribute evenly
        for (const time of this.timeSlots) {
            if (remainingHours <= 0) break;
            
            for (const day of availableDays) {
                if (remainingHours <= 0) break;
                
                if (!this.hasConflict(course.teacher, day, time, teacherSchedule)) {
                    this.addToSchedule(course, schedule, teacherSchedule, day, time);
                    scheduledSlots.push({ day, time });
                    remainingHours--;
                }
            }
        }
        
        // If we couldn't schedule all hours, clean up partial scheduling and return false
        if (remainingHours > 0) {
            // Remove the partially scheduled course
            for (const slot of scheduledSlots) {
                this.removeFromSchedule(course, schedule, teacherSchedule, slot.day, slot.time);
            }
            return false;
        }
        
        return true;
    }
    
    /**
     * Add a course to the schedule
     */
    addToSchedule(course, schedule, teacherSchedule, day, time) {
        // Add to main schedule
        schedule[day][time].push({
            code: course.code,
            name: course.name,
            teacher: course.teacher,
            continued: course.continued || false
        });
        
        // Add to teacher's schedule
        if (!teacherSchedule[course.teacher]) {
            teacherSchedule[course.teacher] = {};
        }
        
        if (!teacherSchedule[course.teacher][day]) {
            teacherSchedule[course.teacher][day] = {};
        }
        
        teacherSchedule[course.teacher][day][time] = course.code;
    }
    
    /**
     * Remove a course from the schedule (for cleanup)
     */
    removeFromSchedule(course, schedule, teacherSchedule, day, time) {
        // Remove from main schedule
        schedule[day][time] = schedule[day][time].filter(c => c.code !== course.code);
        
        // Remove from teacher's schedule
        if (teacherSchedule[course.teacher] && 
            teacherSchedule[course.teacher][day] && 
            teacherSchedule[course.teacher][day][time]) {
            delete teacherSchedule[course.teacher][day][time];
        }
    }
    
    /**
     * Check if scheduling would create a conflict
     */
    hasConflict(teacher, day, time, teacherSchedule) {
        // Check teacher availability
        if (teacherSchedule[teacher] && 
            teacherSchedule[teacher][day] && 
            teacherSchedule[teacher][day][time]) {
            return true;
        }
        
        return false;
    }
}