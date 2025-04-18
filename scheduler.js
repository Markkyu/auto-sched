/**
 * Scheduler.js
 * A constraint-based scheduling algorithm for university course timetabling
 */

class ScheduleSolver {
    constructor() {
        this.courses = [];
        this.teachers = new Set();
        this.schedule = {};
        this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        this.timeSlots = [
            '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
            '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
        ];
        
        // Initialize empty schedule
        this.days.forEach(day => {
            this.schedule[day] = {};
            this.timeSlots.forEach(time => {
                this.schedule[day][time] = null;
            });
        });
    }

    /**
     * Add a course to the scheduling queue
     */
    addCourse(course) {
        this.courses.push(course);
        if (course.teacher) {
            this.teachers.add(course.teacher);
        }
    }

    /**
     * Clear all courses and reset the schedule
     */
    clearAll() {
        this.courses = [];
        this.teachers.clear();
        this.days.forEach(day => {
            this.timeSlots.forEach(time => {
                this.schedule[day][time] = null;
            });
        });
    }

    /**
     * Solve the scheduling problem
     * Returns an object containing the schedule and status
     */
    solve() {
        // Reset schedule
        this.days.forEach(day => {
            this.timeSlots.forEach(time => {
                this.schedule[day][time] = null;
            });
        });

        // Sort courses by constraints (more constrained first)
        const sortedCourses = [...this.courses].sort((a, b) => {
            // Prioritize courses with specific day/time preferences
            const aConstraints = (a.preferredDays?.length || 0) + (a.preferredTimes?.length || 0);
            const bConstraints = (b.preferredDays?.length || 0) + (b.preferredTimes?.length || 0);
            return bConstraints - aConstraints;
        });

        // Apply scheduling strategies
        return this.backtrackingSchedule(sortedCourses);
    }

    /**
     * Backtracking algorithm for constraint satisfaction
     */
    backtrackingSchedule(coursesToSchedule, index = 0) {
        // Base case: all courses have been scheduled
        if (index >= coursesToSchedule.length) {
            return { success: true, schedule: this.cloneSchedule(), conflicts: [] };
        }

        const course = coursesToSchedule[index];
        const availableSlots = this.findAvailableSlots(course);

        // Try each available slot
        for (const slot of availableSlots) {
            const { day, time } = slot;
            
            // Try to place the course in this slot
            if (this.canPlaceCourse(course, day, time)) {
                // Place the course
                this.placeCourse(course, day, time);
                
                // Recursively schedule the next course
                const result = this.backtrackingSchedule(coursesToSchedule, index + 1);
                
                // If successful, return the result
                if (result.success) {
                    return result;
                }
                
                // Otherwise, backtrack
                this.removeCourse(course, day, time);
            }
        }

        // If we reach here, we couldn't schedule this course
        return { 
            success: false, 
            schedule: this.cloneSchedule(), 
            conflicts: [{ 
                course: course, 
                reason: "Could not find a suitable time slot that satisfies all constraints."
            }] 
        };
    }

    /**
     * Find all available slots for a course based on preferences
     */
    findAvailableSlots(course) {
        const slots = [];
        
        // Filter days based on preferences
        const eligibleDays = course.preferredDays && course.preferredDays.length > 0 
            ? course.preferredDays 
            : this.days;
            
        // Filter times based on preferences
        const eligibleTimes = course.preferredTimes && course.preferredTimes.length > 0 
            ? course.preferredTimes 
            : this.timeSlots;
        
        // Generate all possible day-time combinations
        eligibleDays.forEach(day => {
            eligibleTimes.forEach(time => {
                slots.push({ day, time });
            });
        });
        
        // Shuffle slots to avoid patterns in the schedule
        return this.shuffleArray(slots);
    }

    /**
     * Check if a course can be placed in a given slot
     */
    canPlaceCourse(course, day, time) {
        // Check if the slot is already taken
        if (this.schedule[day][time]) {
            return false;
        }
        
        // Check if there's enough consecutive slots for the course duration
        const duration = course.duration || 1;
        if (duration > 1) {
            const timeIndex = this.timeSlots.indexOf(time);
            
            // Make sure there are enough time slots remaining in the day
            if (timeIndex + duration > this.timeSlots.length) {
                return false;
            }
            
            // Check if all consecutive slots are available
            for (let i = 1; i < duration; i++) {
                const nextTimeSlot = this.timeSlots[timeIndex + i];
                if (this.schedule[day][nextTimeSlot]) {
                    return false;
                }
            }
        }
        
        // Check teacher conflicts
        if (course.teacher) {
            // Check if the teacher is already scheduled at this time on this day
            for (const d of this.days) {
                if (this.schedule[d][time] && this.schedule[d][time].teacher === course.teacher) {
                    return false;
                }
                
                // Also check consecutive slots for longer duration courses
                if (duration > 1) {
                    const timeIndex = this.timeSlots.indexOf(time);
                    for (let i = 1; i < duration; i++) {
                        const nextTimeSlot = this.timeSlots[timeIndex + i];
                        if (this.schedule[d][nextTimeSlot] && 
                            this.schedule[d][nextTimeSlot].teacher === course.teacher) {
                            return false;
                        }
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * Place a course in the schedule
     */
    placeCourse(course, day, time) {
        const timeIndex = this.timeSlots.indexOf(time);
        const duration = course.duration || 1;
        
        // Place the course in all required time slots
        for (let i = 0; i < duration; i++) {
            const currentTimeSlot = this.timeSlots[timeIndex + i];
            this.schedule[day][currentTimeSlot] = { ...course };
        }
    }

    /**
     * Remove a course from the schedule
     */
    removeCourse(course, day, time) {
        const timeIndex = this.timeSlots.indexOf(time);
        const duration = course.duration || 1;
        
        // Remove the course from all its slots
        for (let i = 0; i < duration; i++) {
            const currentTimeSlot = this.timeSlots[timeIndex + i];
            this.schedule[day][currentTimeSlot] = null;
        }
    }

    /**
     * Clone the current schedule
     */
    cloneSchedule() {
        const clone = {};
        
        this.days.forEach(day => {
            clone[day] = {};
            this.timeSlots.forEach(time => {
                clone[day][time] = this.schedule[day][time] 
                    ? { ...this.schedule[day][time] } 
                    : null;
            });
        });
        
        return clone;
    }

    /**
     * Shuffle an array (Fisher-Yates algorithm)
     */
    shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}

/**
 * Initialize the application when the DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the solver
    const scheduler = new ScheduleSolver();
    
    // DOM elements
    const courseForm = document.getElementById('course-form');
    const courseQueue = document.getElementById('course-queue');
    const generateBtn = document.getElementById('generate-schedule');
    const clearQueueBtn = document.getElementById('clear-queue');
    const scheduleTimetable = document.getElementById('schedule-timetable');
    const statusContainer = document.getElementById('status-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    // Workflow steps
    const workflowSteps = document.querySelectorAll('.workflow-step');
    
    // Form inputs
    const courseCodeInput = document.getElementById('course-code');
    const courseNameInput = document.getElementById('course-name');
    const teacherInput = document.getElementById('teacher');
    const durationInput = document.getElementById('duration');
    const preferredDaysInput = document.getElementById('preferred-days');
    const preferredTimesInput = document.getElementById('preferred-times');
    
    /**
     * Add a course to the queue
     */
    function addCourseToQueue(e) {
        e.preventDefault();
        
        // Get form values
        const courseCode = courseCodeInput.value.trim();
        const courseName = courseNameInput.value.trim();
        const teacher = teacherInput.value.trim();
        const duration = parseInt(durationInput.value, 10);
        
        // Get selected days
        const preferredDays = Array.from(preferredDaysInput.selectedOptions).map(option => option.value);
        
        // Get selected times
        const preferredTimes = Array.from(preferredTimesInput.selectedOptions).map(option => option.value);
        
        // Validate form
        if (!courseCode || !courseName) {
            showStatus('Please enter course code and name.', 'error');
            return;
        }
        
        // Create course object
        const course = {
            code: courseCode,
            name: courseName,
            teacher: teacher,
            duration: duration,
            preferredDays: preferredDays,
            preferredTimes: preferredTimes
        };
        
        // Add to scheduler
        scheduler.addCourse(course);
        
        // Add to UI
        addCourseToUI(course);
        
        // Reset form
        courseForm.reset();
        
        // Update workflow
        updateWorkflow(1);
        
        // Enable generate button
        generateBtn.disabled = false;
        
        showStatus('Course added to queue.', 'success');
    }
    
    /**
     * Add a course to the UI queue
     */
    function addCourseToUI(course) {
        const item = document.createElement('li');
        item.className = 'queue-item';
        
        let daysText = course.preferredDays && course.preferredDays.length 
            ? course.preferredDays.join(', ') 
            : 'Any';
            
        let timesText = course.preferredTimes && course.preferredTimes.length 
            ? course.preferredTimes.join(', ') 
            : 'Any';
        
        item.innerHTML = `
            <div class="queue-item-header">
                <span class="queue-item-title">${course.code} - ${course.name}</span>
                <button class="queue-item-remove" data-index="${courseQueue.children.length}">×</button>
            </div>
            <div class="queue-item-details">
                Teacher: ${course.teacher || 'Not specified'} | 
                Duration: ${course.duration} hour(s) | 
                Preferred days: ${daysText} | 
                Preferred times: ${timesText}
            </div>
        `;
        
        courseQueue.appendChild(item);
    }
    
    /**
     * Generate the schedule
     */
    function generateSchedule() {
        // Show loading
        loadingIndicator.classList.remove('hidden');
        
        // Update workflow
        updateWorkflow(2);
        
        // Short timeout to allow UI to update
        setTimeout(() => {
            // Solve the scheduling problem
            const result = scheduler.solve();
            
            // Display the schedule
            displaySchedule(result);
            
            // Hide loading
            loadingIndicator.classList.add('hidden');
            
            // Show appropriate status
            if (result.success) {
                showStatus('Schedule generated successfully!', 'success');
            } else {
                showStatus('Could not create a conflict-free schedule. See below for details.', 'warning');
            }
        }, 500);
    }
    
    /**
     * Display the generated schedule
     */
    function displaySchedule(result) {
        // Clear existing schedule
        scheduleTimetable.innerHTML = '';
        
        // Create table header
        const thead = document.createElement('thead');
        let headerRow = document.createElement('tr');
        
        headerRow.innerHTML = '<th>Time</th>';
        scheduler.days.forEach(day => {
            headerRow.innerHTML += `<th>${day}</th>`;
        });
        
        thead.appendChild(headerRow);
        scheduleTimetable.appendChild(thead);
        
        // Create table body
        const tbody = document.createElement('tbody');
        
        scheduler.timeSlots.forEach(time => {
            const row = document.createElement('tr');
            
            // Add time column
            row.innerHTML = `<td>${time}</td>`;
            
            // Add day columns
            scheduler.days.forEach(day => {
                const cell = document.createElement('td');
                const course = result.schedule[day][time];
                
                if (course) {
                    // Only add course card if this is the first hour of the course
                    // (to avoid duplicates for multi-hour courses)
                    const prevTimeIndex = scheduler.timeSlots.indexOf(time) - 1;
                    const prevTime = prevTimeIndex >= 0 ? scheduler.timeSlots[prevTimeIndex] : null;
                    
                    const isPreviousSlotSameCourse = prevTime && 
                        result.schedule[day][prevTime] && 
                        result.schedule[day][prevTime].code === course.code;
                    
                    if (!isPreviousSlotSameCourse) {
                        const courseCard = document.createElement('div');
                        courseCard.className = 'course-card';
                        courseCard.innerHTML = `
                            <div class="course-card-title">${course.code} - ${course.name}</div>
                            <div class="course-card-teacher">${course.teacher || 'No teacher'}</div>
                        `;
                        cell.appendChild(courseCard);
                    }
                }
                
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
        
        scheduleTimetable.appendChild(tbody);
        
        // Show conflicts if any
        if (!result.success && result.conflicts.length > 0) {
            const conflictsContainer = document.createElement('div');
            conflictsContainer.className = 'status-message warning';
            
            let conflictsHtml = '<strong>Scheduling Conflicts:</strong><ul>';
            result.conflicts.forEach(conflict => {
                conflictsHtml += `<li>${conflict.course.code} - ${conflict.course.name}: ${conflict.reason}</li>`;
            });
            conflictsHtml += '</ul>';
            
            conflictsContainer.innerHTML = conflictsHtml;
            
            document.querySelector('.schedule-container').insertBefore(
                conflictsContainer, 
                document.querySelector('.schedule-controls')
            );
        }
        
        // Update workflow
        updateWorkflow(3);
        
        // Show schedule section
        document.getElementById('schedule-section').classList.remove('hidden');
    }
    
    /**
     * Clear the course queue
     */
    function clearQueue() {
        // Clear the scheduler
        scheduler.clearAll();
        
        // Clear the UI
        courseQueue.innerHTML = '';
        
        // Reset workflow
        updateWorkflow(0);
        
        // Disable generate button
        generateBtn.disabled = true;
        
        // Hide schedule section
        document.getElementById('schedule-section').classList.add('hidden');
        
        showStatus('Course queue cleared.', 'info');
    }
    
    /**
     * Remove a course from the queue
     */
    function removeCourse(e) {
        if (e.target.classList.contains('queue-item-remove')) {
            const index = parseInt(e.target.dataset.index, 10);
            
            // Remove from scheduler (recreate the courses array)
            scheduler.courses.splice(index, 1);
            
            // Remove from UI
            e.target.closest('.queue-item').remove();
            
            // Update remaining indices
            document.querySelectorAll('.queue-item-remove').forEach((btn, i) => {
                btn.dataset.index = i;
            });
            
            // Disable generate button if queue is empty
            if (scheduler.courses.length === 0) {
                generateBtn.disabled = true;
                updateWorkflow(0);
            }
            
            showStatus('Course removed from queue.', 'info');
        }
    }
    
    /**
     * Display a status message
     */
    function showStatus(message, type) {
        statusContainer.innerHTML = `
            <div class="status-message ${type}">${message}</div>
        `;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            const messageElement = statusContainer.querySelector('.status-message');
            if (messageElement) {
                messageElement.style.opacity = '0';
                setTimeout(() => {
                    statusContainer.innerHTML = '';
                }, 300);
            }
        }, 5000);
    }
    
    /**
     * Update workflow steps
     */
    function updateWorkflow(activeStep) {
        workflowSteps.forEach((step, index) => {
            if (index < activeStep) {
                step.classList.remove('active');
                step.classList.add('completed');
            } else if (index === activeStep) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
    }
    
    /**
     * Export the schedule as PDF
     */
    function exportSchedule() {
        // Implementation would typically use a library like jsPDF
        alert('Export functionality would be implemented with a PDF generation library');
    }
    
    /**
     * Print the schedule
     */
    function printSchedule() {
        window.print();
    }
    
    // Event listeners
    courseForm.addEventListener('submit', addCourseToQueue);
    generateBtn.addEventListener('click', generateSchedule);
    clearQueueBtn.addEventListener('click', clearQueue);
    courseQueue.addEventListener('click', removeCourse);
    
    // Export and print buttons
    document.getElementById('export-schedule').addEventListener('click', exportSchedule);
    document.getElementById('print-schedule').addEventListener('click', printSchedule);
    
    // Initialize workflow
    updateWorkflow(0);
});