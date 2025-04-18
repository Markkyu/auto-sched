/**
 * ScheduleSolver - A constraint satisfaction algorithm for university course scheduling
 * 
 * This implementation handles scheduling of university courses while respecting
 * constraints such as teacher availability and course hours.
 */
class ScheduleSolver {
    constructor() {
        this.courses = [];
        this.timeSlots = this.generateTimeSlots();
        this.schedule = this.initializeEmptySchedule();
    }

    /**
     * Generate all available time slots
     * @returns {Object} Time slots organized by day and time
     */
    generateTimeSlots() {
        const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
        const startHour = 8; // 8 AM
        const endHour = 18;  // 6 PM
        const slots = {};

        days.forEach(day => {
            slots[day] = [];
            for (let hour = startHour; hour < endHour; hour++) {
                slots[day].push(`${hour}:00`);
                slots[day].push(`${hour}:30`);
            }
        });

        return slots;
    }

    /**
     * Initialize an empty schedule
     * @returns {Object} Empty schedule template
     */
    initializeEmptySchedule() {
        const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
        const schedule = {};

        days.forEach(day => {
            schedule[day] = {};
            this.timeSlots[day].forEach(timeSlot => {
                schedule[day][timeSlot] = [];
            });
        });

        return schedule;
    }

    /**
     * Add a course to be scheduled
     * @param {string} code - Course code
     * @param {string} name - Course name
     * @param {string} teacher - Teacher name
     * @param {number} hours - Course duration in hours
     * @param {string} preferredDays - Preferred days pattern ('MWF', 'TTh', or 'any')
     * @param {number} priority - Course priority (1-5)
     */
    addCourse(code, name, teacher, hours, preferredDays, priority) {
        this.courses.push({
            code,
            name,
            teacher,
            hours,
            preferredDays,
            priority: priority || 3, // Default to medium priority
            scheduled: false
        });
    }

    /**
     * Solve the scheduling problem
     * @returns {Object} Result of the scheduling attempt
     */
    solve() {
        // Reset the schedule
        this.schedule = this.initializeEmptySchedule();
        
        // Mark all courses as unscheduled
        this.courses.forEach(course => {
            course.scheduled = false;
        });

        // Sort courses by priority (highest first)
        const sortedCourses = [...this.courses].sort((a, b) => b.priority - a.priority);
        
        // Try different scheduling strategies
        const schedulingStrategies = [
            this.scheduleByPreferredDays.bind(this),
            this.scheduleByTeacherLoad.bind(this),
            this.scheduleFlexibly.bind(this)
        ];

        let unscheduledCourses = [...sortedCourses];
        let previousUnscheduledCount = Infinity;

        // Try each strategy until we can't improve further
        for (const strategy of schedulingStrategies) {
            const result = strategy(unscheduledCourses);
            unscheduledCourses = result.unscheduledCourses;
            
            // If we've scheduled all courses or made no progress, move to next strategy
            if (unscheduledCourses.length === 0 || unscheduledCourses.length >= previousUnscheduledCount) {
                previousUnscheduledCount = unscheduledCourses.length;
                continue;
            }
            
            previousUnscheduledCount = unscheduledCourses.length;
        }

        // Prepare and return the result
        if (unscheduledCourses.length === 0) {
            return {
                success: true,
                schedule: this.schedule,
                message: 'Successfully scheduled all courses'
            };
        } else {
            const unscheduledCodes = unscheduledCourses.map(c => c.code).join(', ');
            return {
                success: false,
                schedule: this.schedule,
                unscheduledCourses: unscheduledCourses,
                message: `Could not schedule the following courses: ${unscheduledCodes}`
            };
        }
    }

    /**
     * Schedule courses by preferred days
     * @param {Array} courses - Courses to be scheduled
     * @returns {Object} Result with remaining unscheduled courses
     */
    scheduleByPreferredDays(courses) {
        const unscheduledCourses = [];

        for (const course of courses) {
            if (course.scheduled) continue;
            
            let scheduled = false;
            const days = this.getPreferredDays(course.preferredDays);
            
            // Try to schedule on preferred days
            for (const day of days) {
                scheduled = this.attemptScheduleCourse(course, [day]);
                if (scheduled) break;
            }
            
            if (!scheduled) {
                unscheduledCourses.push(course);
            }
        }

        return { unscheduledCourses };
    }

    /**
     * Schedule courses by teacher load
     * @param {Array} courses - Courses to be scheduled
     * @returns {Object} Result with remaining unscheduled courses
     */
    scheduleByTeacherLoad(courses) {
        const unscheduledCourses = [];
        const teacherLoadMap = this.calculateTeacherLoad();

        // Group courses by teacher
        const coursesByTeacher = {};
        for (const course of courses) {
            if (course.scheduled) continue;
            
            if (!coursesByTeacher[course.teacher]) {
                coursesByTeacher[course.teacher] = [];
            }
            coursesByTeacher[course.teacher].push(course);
        }

        // Schedule teachers with heaviest load first
        const teachers = Object.keys(coursesByTeacher).sort((a, b) => 
            (teacherLoadMap[b] || 0) - (teacherLoadMap[a] || 0)
        );

        for (const teacher of teachers) {
            const teacherCourses = coursesByTeacher[teacher];
            
            // Sort courses by priority
            teacherCourses.sort((a, b) => b.priority - a.priority);
            
            for (const course of teacherCourses) {
                const days = this.getAllPossibleDays();
                const scheduled = this.attemptScheduleCourse(course, days);
                
                if (!scheduled) {
                    unscheduledCourses.push(course);
                }
            }
        }

        return { unscheduledCourses };
    }

    /**
     * Schedule courses flexibly (ignoring preferred days)
     * @param {Array} courses - Courses to be scheduled
     * @returns {Object} Result with remaining unscheduled courses
     */
    scheduleFlexibly(courses) {
        const unscheduledCourses = [];
        const allDays = this.getAllPossibleDays();

        for (const course of courses) {
            if (course.scheduled) continue;
            
            const scheduled = this.attemptScheduleCourse(course, allDays);
            
            if (!scheduled) {
                unscheduledCourses.push(course);
            }
        }

        return { unscheduledCourses };
    }

    /**
     * Attempt to schedule a course on given days
     * @param {Object} course - Course to schedule
     * @param {Array} days - Days to try scheduling on
     * @returns {boolean} Whether the course was successfully scheduled
     */
    attemptScheduleCourse(course, days) {
        // MWF or TTh scheduling patterns based on course hours
        const patterns = this.getSchedulingPatterns(course.hours, course.preferredDays);
        
        for (const pattern of patterns) {
            const availableSlots = this.findAvailableTimeSlots(course, days, pattern);
            
            if (availableSlots.length > 0) {
                // Use the first available slot
                const slot = availableSlots[0];
                this.scheduleCourseAtSlot(course, slot.days, slot.startTime, pattern);
                course.scheduled = true;
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find available time slots for a course
     * @param {Object} course - Course to schedule
     * @param {Array} days - Days to search in
     * @param {Object} pattern - Scheduling pattern to use
     * @returns {Array} List of available slots
     */
    findAvailableTimeSlots(course, days, pattern) {
        const availableSlots = [];
        const slotCount = pattern.slotsNeeded;
        
        // For MWF pattern, we need all three days
        if (pattern.type === 'MWF' && days.length < 3) {
            return [];
        }
        
        // For TTh pattern, we need both days
        if (pattern.type === 'TTh' && days.length < 2) {
            return [];
        }

        // Get appropriate days based on pattern
        let schedulingDays = [];
        if (pattern.type === 'MWF') {
            schedulingDays = ['mon', 'wed', 'fri'].filter(day => days.includes(day));
            if (schedulingDays.length < 3) return []; // Need all MWF days
        } else if (pattern.type === 'TTh') {
            schedulingDays = ['tue', 'thu'].filter(day => days.includes(day));
            if (schedulingDays.length < 2) return []; // Need both T and Th
        } else {
            schedulingDays = days;
        }
        
        // Check each time slot in the day(s)
        for (const day of schedulingDays) {
            const slots = this.timeSlots[day];
            
            for (let i = 0; i <= slots.length - slotCount; i++) {
                const startTime = slots[i];
                const endTime = slots[i + slotCount - 1];
                
                // Check if this block is free on all required days
                const conflict = this.hasConflict(course, schedulingDays, startTime, endTime);
                
                if (!conflict) {
                    availableSlots.push({
                        days: schedulingDays,
                        startTime,
                        endTime
                    });
                }
            }
        }
        
        return availableSlots;
    }

    /**
     * Check if there is a scheduling conflict
     * @param {Object} course - Course to check
     * @param {Array} days - Days to check
     * @param {string} startTime - Start time
     * @param {string} endTime - End time
     * @returns {boolean} Whether there is a conflict
     */
    hasConflict(course, days, startTime, endTime) {
        // Get all slots between start and end time
        const startIndex = this.timeSlots[days[0]].indexOf(startTime);
        const endIndex = this.timeSlots[days[0]].indexOf(endTime);
        
        if (startIndex === -1 || endIndex === -1) {
            return true; // Invalid time slot
        }
        
        // Check each day and each slot in the time range
        for (const day of days) {
            for (let i = startIndex; i <= endIndex; i++) {
                const timeSlot = this.timeSlots[day][i];
                
                // Check if teacher already has a course at this time
                const teacherConflict = this.schedule[day][timeSlot].some(
                    c => c.teacher === course.teacher
                );
                
                if (teacherConflict) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Schedule a course at specified time slot
     * @param {Object} course - Course to schedule
     * @param {Array} days - Days to schedule on
     * @param {string} startTime - Start time
     * @param {Object} pattern - Scheduling pattern
     */
    scheduleCourseAtSlot(course, days, startTime, pattern) {
        const startIndex = this.timeSlots[days[0]].indexOf(startTime);
        
        // Schedule the course for each required slot
        for (const day of days) {
            for (let i = 0; i < pattern.slotsNeeded; i++) {
                const timeSlot = this.timeSlots[day][startIndex + i];
                
                // Add course to this time slot
                this.schedule[day][timeSlot].push({
                    code: course.code,
                    name: course.name,
                    teacher: course.teacher
                });
            }
        }
    }

    /**
     * Calculate the total teaching load per teacher
     * @returns {Object} Map of teacher to total hours
     */
    calculateTeacherLoad() {
        const teacherLoad = {};
        
        for (const course of this.courses) {
            if (!teacherLoad[course.teacher]) {
                teacherLoad[course.teacher] = 0;
            }
            teacherLoad[course.teacher] += course.hours;
        }
        
        return teacherLoad;
    }

    /**
     * Get scheduling patterns based on course hours
     * @param {number} hours - Course duration in hours
     * @param {string} preferredDays - Preferred days pattern
     * @returns {Array} List of possible scheduling patterns
     */
    getSchedulingPatterns(hours, preferredDays) {
        const patterns = [];
        
        // 1-hour courses: 2 30-min slots
        if (hours === 1) {
            patterns.push({ type: 'single', slotsNeeded: 2 });
        }
        // 1.5-hour courses: 3 30-min slots
        else if (hours === 1.5) {
            if (preferredDays === 'TTh') {
                patterns.push({ type: 'TTh', slotsNeeded: 3 });
            } else {
                patterns.push({ type: 'single', slotsNeeded: 3 });
            }
        }
        // 2-hour courses: 4 30-min slots
        else if (hours === 2) {
            patterns.push({ type: 'single', slotsNeeded: 4 });
        }
        // 3-hour courses: Split or single block
        else if (hours === 3) {
            if (preferredDays === 'MWF') {
                patterns.push({ type: 'MWF', slotsNeeded: 2 }); // 3 1-hour sessions
            } else if (preferredDays === 'TTh') {
                patterns.push({ type: 'TTh', slotsNeeded: 3 }); // 2 1.5-hour sessions
            } else {
                patterns.push({ type: 'single', slotsNeeded: 6 }); // One 3-hour block
            }
        }
        
        return patterns;
    }

    /**
     * Get preferred days based on pattern
     * @param {string} preferredDays - Preferred days pattern
     * @returns {Array} List of days to try
     */
    getPreferredDays(preferredDays) {
        switch (preferredDays) {
            case 'MWF':
                return ['mon', 'wed', 'fri'];
            case 'TTh':
                return ['tue', 'thu'];
            case 'any':
            default:
                return this.getAllPossibleDays();
        }
    }

    /**
     * Get all possible days
     * @returns {Array} List of all days
     */
    getAllPossibleDays() {
        return ['mon', 'tue', 'wed', 'thu', 'fri'];
    }
}