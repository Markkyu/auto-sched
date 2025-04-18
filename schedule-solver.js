/**
 * Schedule Solver - University Course Scheduling
 * 
 * A constraint satisfaction problem (CSP) inspired algorithm 
 * for scheduling university courses.
 */

class ScheduleSolver {
    constructor() {
        this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        this.timeSlots = [
            '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', 
            '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', 
            '4:00 PM', '5:00 PM', '6:00 PM'
        ];
        
        // Create time slot map for faster reference
        this.timeSlotIndices = {};
        this.timeSlots.forEach((time, index) => {
            this.timeSlotIndices[time] = index;
        });
        
        // Initialize empty schedule
        this.resetSchedule();
    }
    
    resetSchedule() {
        // Create 2D array for schedule [day][timeslot]
        this.schedule = {};
        this.days.forEach(day => {
            this.schedule[day] = {};
            this.timeSlots.forEach(time => {
                this.schedule[day][time] = null;
            });
        });
        
        // Track assigned courses and unassigned courses
        this.assignedCourses = [];
        this.unassignedCourses = [];
    }
    
    /**
     * Main method to solve the scheduling problem
     * @param {Array} courses - Array of course objects
     * @returns {Object} The generated schedule and any unassigned courses
     */
    solveSchedule(courses) {
        console.log("Starting scheduling process with", courses.length, "courses");
        
        // Reset the schedule first
        this.resetSchedule();
        
        // Sort courses by constraints (more constrained first)
        const sortedCourses = this.sortCoursesByConstraints(courses);
        
        // Try different scheduling strategies in order of complexity
        const strategies = [
            this.applyMWFTThStrategy.bind(this),
            this.applyPreferredDaysStrategy.bind(this),
            this.applyGreedyStrategy.bind(this)
        ];
        
        for (const strategy of strategies) {
            // Apply current strategy
            strategy(sortedCourses);
            
            // If all courses are assigned, we're done
            if (this.unassignedCourses.length === 0) {
                break;
            }
            
            console.log(`After strategy, ${this.unassignedCourses.length} courses remain unassigned`);
            
            // If we still have unassigned courses, reset and try the next strategy
            if (strategies.indexOf(strategy) < strategies.length - 1) {
                this.resetSchedule();
            }
        }
        
        return {
            schedule: this.schedule,
            assignedCourses: this.assignedCourses,
            unassignedCourses: this.unassignedCourses
        };
    }
    
    /**
     * Sort courses by their constraints, with more constrained courses first
     */
    sortCoursesByConstraints(courses) {
        return [...courses].sort((a, b) => {
            // Courses with specific teacher preferences
            const aTeacherConstraint = a.teacher && a.teacherPreferences && a.teacherPreferences.length > 0 ? 1 : 0;
            const bTeacherConstraint = b.teacher && b.teacherPreferences && b.teacherPreferences.length > 0 ? 1 : 0;
            
            // Courses with specific time preferences
            const aTimeConstraint = a.preferredTimes && a.preferredTimes.length > 0 ? 1 : 0;
            const bTimeConstraint = b.preferredTimes && b.preferredTimes.length > 0 ? 1 : 0;
            
            // Courses with specific day preferences
            const aDayConstraint = a.preferredDays && a.preferredDays.length > 0 ? 1 : 0;
            const bDayConstraint = b.preferredDays && b.preferredDays.length > 0 ? 1 : 0;
            
            // Calculate total constraints
            const aConstraints = aTeacherConstraint + aTimeConstraint + aDayConstraint;
            const bConstraints = bTeacherConstraint + bTimeConstraint + bDayConstraint;
            
            // Sort by number of constraints (descending)
            return bConstraints - aConstraints;
        });
    }
    
    /**
     * Schedule courses following a Monday-Wednesday-Friday and Tuesday-Thursday pattern
     */
    applyMWFTThStrategy(courses) {
        const mwfCourses = [];
        const tthCourses = [];
        
        // Split courses by preferred days or assign to MWF or TTh
        courses.forEach(course => {
            // Check if course has a preference for MW, MWF, TTh
            if (course.preferredDays && course.preferredDays.length > 0) {
                // Check if course prefers at least 2 of M, W, F
                const prefersMWF = ['Monday', 'Wednesday', 'Friday'].filter(day => 
                    course.preferredDays.includes(day)
                ).length >= 2;
                
                // Check if course prefers Tuesday and Thursday
                const prefersTTh = course.preferredDays.includes('Tuesday') && 
                                  course.preferredDays.includes('Thursday');
                
                if (prefersMWF) {
                    mwfCourses.push(course);
                } else if (prefersTTh) {
                    tthCourses.push(course);
                } else {
                    // Assign to whichever has fewer courses
                    if (mwfCourses.length <= tthCourses.length) {
                        mwfCourses.push(course);
                    } else {
                        tthCourses.push(course);
                    }
                }
            } else {
                // No preference, assign to whichever has fewer courses
                if (mwfCourses.length <= tthCourses.length) {
                    mwfCourses.push(course);
                } else {
                    tthCourses.push(course);
                }
            }
        });
        
        console.log(`MWF courses: ${mwfCourses.length}, TTh courses: ${tthCourses.length}`);
        
        // First try to assign MWF courses
        mwfCourses.forEach(course => {
            const daysToUse = course.preferredDays && course.preferredDays.length > 0
                ? course.preferredDays.filter(day => ['Monday', 'Wednesday', 'Friday'].includes(day))
                : ['Monday', 'Wednesday', 'Friday'];
            
            // If preference doesn't include any MWF days, use them all
            const schedulingDays = daysToUse.length > 0 
                ? daysToUse 
                : ['Monday', 'Wednesday', 'Friday'];
            
            this.assignCourseToSameDailyTime(course, schedulingDays);
        });
        
        // Then assign TTh courses
        tthCourses.forEach(course => {
            const daysToUse = course.preferredDays && course.preferredDays.length > 0
                ? course.preferredDays.filter(day => ['Tuesday', 'Thursday'].includes(day))
                : ['Tuesday', 'Thursday'];
            
            // If preference doesn't include any TTh days, use them all
            const schedulingDays = daysToUse.length > 0 
                ? daysToUse 
                : ['Tuesday', 'Thursday'];
            
            this.assignCourseToSameDailyTime(course, schedulingDays);
        });
    }
    
    /**
     * Schedule courses based on preferred days
     */
    applyPreferredDaysStrategy(courses) {
        console.log("Applying preferred days strategy");
        
        for (const course of courses) {
            let daysToUse = [];
            
            // Use preferred days if available
            if (course.preferredDays && course.preferredDays.length > 0) {
                daysToUse = [...course.preferredDays];
            } else {
                // No preference, use all days
                daysToUse = [...this.days];
            }
            
            // Try to assign the course using these days
            if (this.assignCourseUsingPreference(course, daysToUse)) {
                this.assignedCourses.push(course);
            } else {
                this.unassignedCourses.push(course);
            }
        }
    }
    
    /**
     * Greedy approach - try to fit courses wherever possible
     */
    applyGreedyStrategy(courses) {
        console.log("Applying greedy strategy");
        
        for (const course of courses) {
            let assigned = false;
            
            // Try each time slot
            for (const time of this.timeSlots) {
                // Skip if this time is not preferred (if preferences exist)
                if (course.preferredTimes && course.preferredTimes.length > 0 && 
                    !course.preferredTimes.includes(time)) {
                    continue;
                }
                
                // Try each day
                for (const day of this.days) {
                    // Skip if this day is not preferred (if preferences exist)
                    if (course.preferredDays && course.preferredDays.length > 0 && 
                        !course.preferredDays.includes(day)) {
                        continue;
                    }
                    
                    // Check if this slot is free
                    if (!this.schedule[day][time]) {
                        // Check teacher availability
                        if (this.isTeacherAvailable(course.teacher, day, time)) {
                            // Assign the course
                            this.schedule[day][time] = {
                                course: course.courseName,
                                code: course.courseCode,
                                teacher: course.teacher
                            };
                            assigned = true;
                            break;
                        }
                    }
                }
                
                if (assigned) break;
            }
            
            if (assigned) {
                this.assignedCourses.push(course);
            } else {
                this.unassignedCourses.push(course);
            }
        }
    }
    
    /**
     * Assign a course to the same time slot on multiple days
     */
    assignCourseToSameDailyTime(course, days) {
        console.log(`Trying to assign ${course.courseName} to days: ${days.join(', ')}`);
        
        // Find a time slot that works for all specified days
        let assigned = false;
        
        // Sort times by preference if available
        let sortedTimes = [...this.timeSlots];
        if (course.preferredTimes && course.preferredTimes.length > 0) {
            // Put preferred times first, then the rest
            sortedTimes = [
                ...course.preferredTimes,
                ...this.timeSlots.filter(time => !course.preferredTimes.includes(time))
            ];
        }
        
        // Try each time slot
        for (const time of sortedTimes) {
            let timeWorkForAllDays = true;
            
            // Check if this time works for all specified days
            for (const day of days) {
                if (this.schedule[day][time] || !this.isTeacherAvailable(course.teacher, day, time)) {
                    timeWorkForAllDays = false;
                    break;
                }
            }
            
            // If time works for all days, assign the course
            if (timeWorkForAllDays) {
                for (const day of days) {
                    this.schedule[day][time] = {
                        course: course.courseName,
                        code: course.courseCode,
                        teacher: course.teacher
                    };
                }
                this.assignedCourses.push(course);
                assigned = true;
                break;
            }
        }
        
        // If course couldn't be assigned, add to unassigned list
        if (!assigned) {
            this.unassignedCourses.push(course);
        }
        
        return assigned;
    }
    
    /**
     * Try to assign a course using preferred days and times
     */
    assignCourseUsingPreference(course, days) {
        console.log(`Trying to assign ${course.courseName} using preferences`);
        
        // Sort times by preference if available
        let sortedTimes = [...this.timeSlots];
        if (course.preferredTimes && course.preferredTimes.length > 0) {
            // Put preferred times first, then the rest
            sortedTimes = [
                ...course.preferredTimes,
                ...this.timeSlots.filter(time => !course.preferredTimes.includes(time))
            ];
        }
        
        // Try to find available slots
        const availableSlots = [];
        
        for (const day of days) {
            for (const time of sortedTimes) {
                if (!this.schedule[day][time] && this.isTeacherAvailable(course.teacher, day, time)) {
                    availableSlots.push({ day, time });
                }
            }
        }
        
        // If no available slots, return false
        if (availableSlots.length === 0) return false;
        
        // Choose the best slots based on course hours (default to 1 if not specified)
        const hoursNeeded = course.hours || 1;
        const chosenSlots = availableSlots.slice(0, hoursNeeded);
        
        // Assign the course to the chosen slots
        for (const slot of chosenSlots) {
            this.schedule[slot.day][slot.time] = {
                course: course.courseName,
                code: course.courseCode,
                teacher: course.teacher
            };
        }
        
        return true;
    }
    
    /**
     * Check if a teacher is available at the given day and time
     */
    isTeacherAvailable(teacher, day, time) {
        if (!teacher) return true; // No teacher specified, always available
        
        // Check if the teacher is already assigned at this time on this day
        for (const d in this.schedule) {
            if (d === day) {
                for (const t in this.schedule[d]) {
                    if (this.schedule[d][t] && 
                        this.schedule[d][t].teacher === teacher && 
                        t === time) {
                        return false; // Teacher already has a class at this time
                    }
                }
            }
        }
        
        // Check if the teacher has preferences and if this slot is in their preferences
        const teacherCourses = this.assignedCourses.filter(c => c.teacher === teacher);
        for (const course of teacherCourses) {
            if (course.teacherPreferences) {
                // Teacher has specific preferences
                const dayPrefs = course.teacherPreferences.days || [];
                const timePrefs = course.teacherPreferences.times || [];
                
                // If teacher has day preferences and this day is not in it
                if (dayPrefs.length > 0 && !dayPrefs.includes(day)) {
                    return false;
                }
                
                // If teacher has time preferences and this time is not in it
                if (timePrefs.length > 0 && !timePrefs.includes(time)) {
                    return false;
                }
            }
        }
        
        return true; // Teacher is available
    }
    
    /**
     * Format the schedule into an array for easier display
     */
    formatSchedule() {
        const formattedSchedule = [];
        
        // Add header row with days
        const headerRow = ['Time', ...this.days];
        formattedSchedule.push(headerRow);
        
        // Add rows for each time slot
        for (const time of this.timeSlots) {
            const row = [time];
            
            for (const day of this.days) {
                const cell = this.schedule[day][time];
                if (cell) {
                    row.push(`${cell.code} - ${cell.course} (${cell.teacher})`);
                } else {
                    row.push('');
                }
            }
            
            formattedSchedule.push(row);
        }
        
        return formattedSchedule;
    }
}

/**
 * Function to generate a schedule from course data
 * @param {Array} courses - Array of course objects
 * @returns {Object} The generated schedule
 */
function generateSchedule(courses) {
    console.log("Generating schedule for courses:", courses);
    
    const solver = new ScheduleSolver();
    const result = solver.solveSchedule(courses);
    
    return {
        schedule: result.schedule,
        formattedSchedule: solver.formatSchedule(),
        assignedCourses: result.assignedCourses,
        unassignedCourses: result.unassignedCourses
    };
}