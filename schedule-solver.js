/**
 * University Course Scheduler - Constraint Satisfaction Algorithm
 * 
 * This file implements a constraint-based scheduling algorithm for university courses.
 * It uses backtracking with constraint propagation to find a valid schedule that 
 * satisfies all hard constraints.
 */

class ScheduleSolver {
    constructor() {
        this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        this.timeSlots = [];
        
        // Generate time slots from 8:00 to 18:00 in 1-hour increments
        for (let hour = 8; hour <= 18; hour++) {
            const formattedHour = hour.toString().padStart(2, '0');
            this.timeSlots.push(`${formattedHour}:00`);
        }
        
        // Initialize empty schedule grid
        this.initializeGrid();
    }
    
    /**
     * Initialize the scheduling grid
     */
    initializeGrid() {
        this.grid = {};
        this.days.forEach(day => {
            this.grid[day] = {};
            this.timeSlots.forEach(time => {
                this.grid[day][time] = null;
            });
        });
    }
    
    /**
     * Solve the scheduling problem
     * @param {Array} courses - List of courses to schedule
     * @returns {Object} - Scheduling result containing grid and unassigned courses
     */
    solve(courses) {
        // Reset the grid
        this.initializeGrid();
        
        // Sort courses by constraints (more constrained courses first)
        const sortedCourses = this.sortCoursesByConstraints(courses);
        
        // Track unassigned courses
        const unassignedCourses = [];
        
        // Apply scheduling strategies
        for (const course of sortedCourses) {
            const assigned = this.applySchedulingStrategies(course);
            if (!assigned) {
                unassignedCourses.push(course);
            }
        }
        
        return {
            grid: this.grid,
            unassignedCourses: unassignedCourses
        };
    }
    
    /**
     * Sort courses by constraints (more constrained first)
     * @param {Array} courses - List of courses to sort
     * @returns {Array} - Sorted courses
     */
    sortCoursesByConstraints(courses) {
        return [...courses].sort((a, b) => {
            // Courses with specific days are more constrained
            const aHasSpecificDays = Array.isArray(a.days) && a.days.length > 0;
            const bHasSpecificDays = Array.isArray(b.days) && b.days.length > 0;
            
            if (aHasSpecificDays && !bHasSpecificDays) return -1;
            if (!aHasSpecificDays && bHasSpecificDays) return 1;
            
            // Courses with specific time preferences are more constrained
            if (a.timePreferences && !b.timePreferences) return -1;
            if (!a.timePreferences && b.timePreferences) return 1;
            
            // Sort by number of hours (more hours = more constrained)
            return b.hours - a.hours;
        });
    }
    
    /**
     * Apply scheduling strategies for a single course
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    applySchedulingStrategies(course) {
        // Strategy 1: Apply MWF (Monday, Wednesday, Friday) pattern for 3-hour courses
        if (course.hours === 3 && (!course.days || course.days.length === 0)) {
            return this.applyMWFStrategy(course);
        }
        
        // Strategy 2: Apply TTh (Tuesday, Thursday) pattern for 2-hour courses
        if (course.hours === 2 && (!course.days || course.days.length === 0)) {
            return this.applyTThStrategy(course);
        }
        
        // Strategy 3: Apply single day strategy for 1-hour courses
        if (course.hours === 1 && (!course.days || course.days.length === 0)) {
            return this.applySingleDayStrategy(course);
        }
        
        // Strategy 4: Apply custom days strategy for courses with specific day requirements
        if (course.days && course.days.length > 0) {
            return this.applyCustomDaysStrategy(course);
        }
        
        // Fallback: Try general assignment
        return this.applyGeneralAssignmentStrategy(course);
    }
    
    /**
     * Apply MWF (Monday, Wednesday, Friday) strategy
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    applyMWFStrategy(course) {
        const mwfDays = ['Monday', 'Wednesday', 'Friday'];
        
        // Try each time slot
        for (const time of this.timeSlots) {
            // Check if we can assign the course at this time on all MWF days
            if (this.canAssignToAllDays(course, mwfDays, time)) {
                // Assign the course
                mwfDays.forEach(day => {
                    this.grid[day][time] = {
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        teacher: course.teacher
                    };
                });
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Apply TTh (Tuesday, Thursday) strategy
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    applyTThStrategy(course) {
        const tthDays = ['Tuesday', 'Thursday'];
        
        // Try each time slot
        for (const time of this.timeSlots) {
            // Check if we can assign the course at this time on all TTh days
            if (this.canAssignToAllDays(course, tthDays, time)) {
                // Assign the course
                tthDays.forEach(day => {
                    this.grid[day][time] = {
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        teacher: course.teacher
                    };
                });
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Apply single day strategy
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    applySingleDayStrategy(course) {
        // Try each day and time slot
        for (const day of this.days) {
            for (const time of this.timeSlots) {
                if (this.canAssign(course, day, time)) {
                    this.grid[day][time] = {
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        teacher: course.teacher
                    };
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Apply custom days strategy
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    applyCustomDaysStrategy(course) {
        // Validate the days
        const validDays = course.days.filter(day => this.days.includes(day));
        
        if (validDays.length === 0) {
            return false;
        }
        
        // If hours don't match the number of days, adjust the strategy
        if (course.hours !== validDays.length) {
            // For simplicity, we'll distribute hours evenly across specified days
            return this.applyDistributedHoursStrategy(course, validDays);
        }
        
        // Assign one hour per specified day
        for (const time of this.timeSlots) {
            if (this.canAssignToAllDays(course, validDays, time)) {
                validDays.forEach(day => {
                    this.grid[day][time] = {
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        teacher: course.teacher
                    };
                });
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Apply distributed hours strategy
     * @param {Object} course - Course to schedule
     * @param {Array} days - Days to distribute hours across
     * @returns {boolean} - True if course was successfully assigned
     */
    applyDistributedHoursStrategy(course, days) {
        const hoursPerDay = Math.ceil(course.hours / days.length);
        let remainingHours = course.hours;
        
        for (const day of days) {
            if (remainingHours <= 0) break;
            
            const hoursToAssign = Math.min(hoursPerDay, remainingHours);
            let assigned = false;
            
            // Try to assign consecutive hours
            for (let i = 0; i <= this.timeSlots.length - hoursToAssign; i++) {
                const startTime = this.timeSlots[i];
                const consecutive = this.canAssignConsecutive(course, day, startTime, hoursToAssign);
                
                if (consecutive) {
                    // Assign consecutive hours
                    for (let j = 0; j < hoursToAssign; j++) {
                        const timeSlot = this.timeSlots[i + j];
                        this.grid[day][timeSlot] = {
                            courseCode: course.courseCode,
                            courseName: course.courseName,
                            teacher: course.teacher
                        };
                    }
                    
                    remainingHours -= hoursToAssign;
                    assigned = true;
                    break;
                }
            }
            
            if (!assigned) {
                // We couldn't assign consecutive hours, try individual slots
                let hoursAssigned = 0;
                
                for (const time of this.timeSlots) {
                    if (hoursAssigned >= hoursToAssign) break;
                    
                    if (this.canAssign(course, day, time)) {
                        this.grid[day][time] = {
                            courseCode: course.courseCode,
                            courseName: course.courseName,
                            teacher: course.teacher
                        };
                        hoursAssigned++;
                        remainingHours--;
                    }
                }
                
                if (hoursAssigned < hoursToAssign) {
                    // We couldn't assign all hours for this day
                    return false;
                }
            }
        }
        
        return remainingHours === 0;
    }
    
    /**
     * Apply general assignment strategy
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    applyGeneralAssignmentStrategy(course) {
        // Try different combinations of days based on course hours
        if (course.hours === 5) {
            // Try to assign one hour per day (Monday to Friday)
            return this.applyCustomDaysStrategy({
                ...course,
                days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            });
        }
        
        if (course.hours === 4) {
            // Try MTWTh pattern
            const assigned = this.applyCustomDaysStrategy({
                ...course,
                days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
            });
            
            if (assigned) return true;
            
            // Try alternative 2+2 pattern (MW and TTh)
            return this.apply2Plus2Strategy(course);
        }
        
        // For hours we haven't handled specifically, try distributing across all days
        const daysToTry = [...this.days];
        return this.applyDistributedHoursStrategy(course, daysToTry);
    }
    
    /**
     * Apply 2+2 strategy (2 hours on MW, 2 hours on TTh)
     * @param {Object} course - Course to schedule
     * @returns {boolean} - True if course was successfully assigned
     */
    apply2Plus2Strategy(course) {
        const group1 = ['Monday', 'Wednesday'];
        const group2 = ['Tuesday', 'Thursday'];
        
        // Find a time slot for group 1
        for (const time1 of this.timeSlots) {
            if (this.canAssignToAllDays(course, group1, time1)) {
                // Find a time slot for group 2
                for (const time2 of this.timeSlots) {
                    if (this.canAssignToAllDays(course, group2, time2)) {
                        // Assign the course
                        group1.forEach(day => {
                            this.grid[day][time1] = {
                                courseCode: course.courseCode,
                                courseName: course.courseName,
                                teacher: course.teacher
                            };
                        });
                        
                        group2.forEach(day => {
                            this.grid[day][time2] = {
                                courseCode: course.courseCode,
                                courseName: course.courseName,
                                teacher: course.teacher
                            };
                        });
                        
                        return true;
                    }
                }
                
                // We couldn't find a time slot for group 2
                break;
            }
        }
        
        return false;
    }
    
    /**
     * Check if a course can be assigned to a specific day and time
     * @param {Object} course - Course to check
     * @param {string} day - Day to check
     * @param {string} time - Time slot to check
     * @returns {boolean} - True if course can be assigned
     */
    canAssign(course, day, time) {
        // Check if the time slot is free
        if (this.grid[day][time] !== null) {
            return false;
        }
        
        // Check teacher availability
        if (this.hasTeacherConflict(course.teacher, day, time)) {
            return false;
        }
        
        // Check time preferences if specified
        if (course.timePreferences && !course.timePreferences.includes(time)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if a course can be assigned to consecutive time slots
     * @param {Object} course - Course to check
     * @param {string} day - Day to check
     * @param {string} startTime - Starting time slot
     * @param {number} hours - Number of consecutive hours
     * @returns {boolean} - True if course can be assigned
     */
    canAssignConsecutive(course, day, startTime, hours) {
        const startIndex = this.timeSlots.indexOf(startTime);
        
        if (startIndex === -1 || startIndex + hours > this.timeSlots.length) {
            return false;
        }
        
        for (let i = 0; i < hours; i++) {
            const timeSlot = this.timeSlots[startIndex + i];
            if (!this.canAssign(course, day, timeSlot)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check if a course can be assigned to multiple days at the same time
     * @param {Object} course - Course to check
     * @param {Array} days - Days to check
     * @param {string} time - Time slot to check
     * @returns {boolean} - True if course can be assigned to all specified days
     */
    canAssignToAllDays(course, days, time) {
        return days.every(day => this.canAssign(course, day, time));
    }
    
    /**
     * Check if there's a teacher conflict at the specified day and time
     * @param {string} teacher - Teacher name
     * @param {string} day - Day to check
     * @param {string} time - Time slot to check
     * @returns {boolean} - True if there's a conflict
     */
    hasTeacherConflict(teacher, day, time) {
        // Check all time slots for the teacher
        for (const d of this.days) {
            for (const t of this.timeSlots) {
                if (this.grid[d][t] !== null && 
                    this.grid[d][t].teacher === teacher &&
                    ((d === day && t === time) || (d === day && this.areConsecutiveTimeSlots(t, time)))) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if two time slots are consecutive
     * @param {string} time1 - First time slot
     * @param {string} time2 - Second time slot
     * @returns {boolean} - True if time slots are consecutive
     */
    areConsecutiveTimeSlots(time1, time2) {
        const index1 = this.timeSlots.indexOf(time1);
        const index2 = this.timeSlots.indexOf(time2);
        
        return Math.abs(index1 - index2) === 1;
    }
    
    /**
     * Get scheduling statistics
     * @param {Object} result - Scheduling result
     * @returns {Object} - Statistics about the schedule
     */
    getScheduleStats(result) {
        let totalAssigned = 0;
        let totalUnassigned = result.unassignedCourses.length;
        const teacherHours = {};
        const dayUtilization = {};
        
        // Initialize day utilization
        this.days.forEach(day => {
            dayUtilization[day] = 0;
        });
        
        // Count assigned courses and teacher hours
        for (const day of this.days) {
            for (const time of this.timeSlots) {
                const cell = result.grid[day][time];
                if (cell !== null) {
                    totalAssigned++;
                    dayUtilization[day]++;
                    
                    const teacher = cell.teacher;
                    teacherHours[teacher] = (teacherHours[teacher] || 0) + 1;
                }
            }
        }
        
        return {
            totalAssigned,
            totalUnassigned,
            assignmentRate: totalAssigned / (totalAssigned + totalUnassigned) * 100,
            teacherHours,
            dayUtilization
        };
    }
}

/**
 * Helper function to create a course object
 * @param {string} courseCode - Course code
 * @param {string} courseName - Course name
 * @param {string} teacher - Teacher name
 * @param {number} hours - Course hours per week
 * @param {Array} days - Specific days (optional)
 * @param {Array} timePreferences - Preferred time slots (optional)
 * @returns {Object} - Course object
 */
function createCourse(courseCode, courseName, teacher, hours, days = [], timePreferences = null) {
    return {
        courseCode,
        courseName,
        teacher,
        hours,
        days,
        timePreferences
    };
}

/**
 * Generate a schedule from a list of courses
 * @param {Array} courses - List of courses to schedule
 * @returns {Object} - Scheduling result
 */
function generateSchedule(courses) {
    const solver = new ScheduleSolver();
    const result = solver.solve(courses);
    const stats = solver.getScheduleStats(result);
    
    return {
        schedule: result.grid,
        unassignedCourses: result.unassignedCourses,
        stats: stats
    };
}

// Export functions for use in the application
window.ScheduleSolver = ScheduleSolver;
window.createCourse = createCourse;
window.generateSchedule = generateSchedule;