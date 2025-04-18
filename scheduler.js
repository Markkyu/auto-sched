/**
 * University Course Scheduler
 * A hierarchical constraint-based scheduling system
 */

class ScheduleManager {
    constructor() {
        this.courseQueue = [];
        this.currentSchedule = null;
        this.solver = new ScheduleSolver();
        this.initializeEventListeners();
        this.apiUrl = 'http://localhost:5000/generate-schedule'; // Change when deploying
        this.useApi = false; // Set to true to use the Python backend
    }

    initializeEventListeners() {
        // Course form submission
        document.getElementById('course-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCourseToQueue();
        });

        // Generate schedule button
        document.getElementById('generate-schedule-btn').addEventListener('click', () => {
            this.generateSchedule();
        });

        // Clear queue button
        document.getElementById('clear-queue-btn').addEventListener('click', () => {
            this.clearQueue();
        });

        // Export schedule button
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportSchedule();
        });

        // Print schedule button
        document.getElementById('print-btn').addEventListener('click', () => {
            this.printSchedule();
        });
    }

    addCourseToQueue() {
        const courseCode = document.getElementById('course-code').value;
        const courseName = document.getElementById('course-name').value;
        const teacher = document.getElementById('teacher').value;
        const duration = parseInt(document.getElementById('duration').value, 10);
        const preferredDays = Array.from(document.getElementById('preferred-days').selectedOptions).map(option => option.value);
        const preferredTimes = document.getElementById('preferred-times').value;

        if (!courseCode || !courseName || !teacher || !duration) {
            this.showStatus('Please fill in all required fields', 'error');
            return;
        }

        const course = {
            id: Date.now().toString(),
            code: courseCode,
            name: courseName,
            teacher,
            duration,
            preferredDays: preferredDays,
            preferredTimes: preferredTimes
        };

        this.courseQueue.push(course);
        this.updateQueueDisplay();
        this.resetForm();
        this.showStatus(`Course ${courseCode} added to queue`, 'success');
    }

    updateQueueDisplay() {
        const queueList = document.getElementById('queue-list');
        queueList.innerHTML = '';

        this.courseQueue.forEach((course) => {
            const listItem = document.createElement('li');
            listItem.className = 'queue-item';
            listItem.innerHTML = `
                <div class="queue-item-info">
                    <span class="course-code">${course.code}: ${course.name}</span>
                    <span class="teacher-name">${course.teacher} (${course.duration}hr)</span>
                </div>
                <button class="remove-course-btn" data-id="${course.id}">×</button>
            `;
            queueList.appendChild(listItem);
        });

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-course-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const courseId = e.target.getAttribute('data-id');
                this.removeCourseFromQueue(courseId);
            });
        });

        // Toggle generate button based on queue
        const generateButton = document.getElementById('generate-schedule-btn');
        generateButton.disabled = this.courseQueue.length === 0;
    }

    removeCourseFromQueue(courseId) {
        this.courseQueue = this.courseQueue.filter(course => course.id !== courseId);
        this.updateQueueDisplay();
    }

    resetForm() {
        document.getElementById('course-code').value = '';
        document.getElementById('course-name').value = '';
        document.getElementById('teacher').value = '';
        document.getElementById('duration').value = '1';
        document.getElementById('preferred-days').selectedIndex = -1;
        document.getElementById('preferred-times').value = '';
    }

    clearQueue() {
        this.courseQueue = [];
        this.updateQueueDisplay();
        this.clearTimetable();
    }

    async generateSchedule() {
        if (this.courseQueue.length === 0) {
            this.showStatus('Please add courses to the queue first', 'error');
            return;
        }

        const loadingIndicator = document.getElementById('loading-indicator');
        loadingIndicator.classList.remove('hidden');

        try {
            if (this.useApi) {
                await this.generateScheduleWithApi();
            } else {
                this.generateScheduleLocally();
            }
        } catch (error) {
            console.error('Error generating schedule:', error);
            this.showStatus('Failed to generate schedule: ' + error.message, 'error');
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    }

    async generateScheduleWithApi() {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    courses: this.courseQueue
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.currentSchedule = data.schedule;
                this.renderTimetable(this.currentSchedule);
                this.showStatus('Schedule generated successfully using API', 'success');
                this.updateWorkflowIndicator('complete');
            } else {
                this.showStatus('Could not generate schedule: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('API error:', error);
            this.showStatus('API error. Falling back to local scheduler.', 'warning');
            this.generateScheduleLocally();
        }
    }

    generateScheduleLocally() {
        try {
            const result = this.solver.solve(this.courseQueue);
            
            if (result.success) {
                this.currentSchedule = result.schedule;
                this.renderTimetable(this.currentSchedule);
                this.showStatus('Schedule generated successfully', 'success');
                this.updateWorkflowIndicator('complete');
            } else {
                this.showStatus('Could not generate schedule: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Scheduler error:', error);
            this.showStatus('Error in schedule generation: ' + error.message, 'error');
        }
    }

    renderTimetable(schedule) {
        // Clear existing timetable
        this.clearTimetable();
        
        const timetable = document.getElementById('timetable');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Time</th>';
        days.forEach(day => {
            headerRow.innerHTML += `<th>${day}</th>`;
        });
        timetable.appendChild(headerRow);
        
        // Create time slots rows (8 AM to 5 PM)
        for (let hour = 8; hour <= 17; hour++) {
            const timeString = hour > 12 ? `${hour-12}:00 PM` : `${hour}:00 AM`;
            const row = document.createElement('tr');
            row.innerHTML = `<td class="time-slot">${timeString}</td>`;
            
            // Add empty cells for each day
            days.forEach(day => {
                row.innerHTML += '<td></td>';
            });
            
            timetable.appendChild(row);
        }
        
        // Populate schedule
        schedule.forEach(assignment => {
            const dayIndex = days.indexOf(assignment.day) + 1; // +1 for time column
            if (dayIndex > 0) {
                const hourIndex = assignment.hour - 8 + 1; // Convert to row index (8 AM = row 1)
                
                if (hourIndex > 0 && hourIndex <= 10) { // Only show 8 AM to 5 PM
                    const cell = timetable.rows[hourIndex].cells[dayIndex];
                    
                    // Check if cell already has a course (conflict)
                    const hasConflict = cell.innerHTML !== '';
                    
                    const courseElement = document.createElement('div');
                    courseElement.className = `course-cell${hasConflict ? ' conflict' : ''}`;
                    courseElement.innerHTML = `
                        <span class="course-name">${assignment.course.code}</span>
                        <span class="course-teacher">${assignment.course.teacher}</span>
                    `;
                    
                    cell.appendChild(courseElement);
                }
            }
        });
    }

    clearTimetable() {
        const timetable = document.getElementById('timetable');
        timetable.innerHTML = '';
        this.currentSchedule = null;
    }

    exportSchedule() {
        if (!this.currentSchedule) {
            this.showStatus('No schedule to export', 'error');
            return;
        }

        const scheduleData = {
            courses: this.courseQueue,
            schedule: this.currentSchedule,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(scheduleData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportLink = document.createElement('a');
        exportLink.setAttribute('href', dataUri);
        exportLink.setAttribute('download', 'university-schedule.json');
        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);
        
        this.showStatus('Schedule exported successfully', 'success');
    }

    printSchedule() {
        if (!this.currentSchedule) {
            this.showStatus('No schedule to print', 'error');
            return;
        }
        
        window.print();
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.classList.remove('hidden');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 5000);
    }

    updateWorkflowIndicator(stage) {
        const steps = document.querySelectorAll('.workflow-step');
        steps.forEach(step => step.classList.remove('active'));
        
        if (stage === 'input') {
            steps[0].classList.add('active');
            steps[0].classList.add('completed');
        } else if (stage === 'scheduling') {
            steps[0].classList.add('completed');
            steps[1].classList.add('active');
        } else if (stage === 'complete') {
            steps.forEach(step => step.classList.add('completed'));
            steps[2].classList.add('active');
        }
    }
}

class ScheduleSolver {
    constructor() {
        this.days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        this.hours = Array.from({length: 10}, (_, i) => i + 8); // 8 AM to 5 PM
    }

    solve(courses) {
        try {
            // Make a deep copy of courses to avoid modifying the original
            const coursesCopy = JSON.parse(JSON.stringify(courses));
            
            // Initialize an empty schedule
            let schedule = [];
            
            // Initialize teacher and room availability
            const teacherAvailability = this.initializeAvailability();
            
            // First, try to place courses respecting all constraints
            const result = this.backtrackScheduling(coursesCopy, schedule, teacherAvailability);
            
            if (result.success) {
                return { success: true, schedule: result.schedule };
            }
            
            // If strict scheduling fails, try with relaxed constraints
            const relaxedResult = this.relaxedScheduling(coursesCopy);
            
            if (relaxedResult.success) {
                return { 
                    success: true, 
                    schedule: relaxedResult.schedule,
                    message: 'Schedule created with some relaxed constraints'
                };
            }
            
            return { 
                success: false, 
                message: 'Could not create a valid schedule. Try reducing constraints or removing some courses.'
            };
        } catch (error) {
            console.error('Solver error:', error);
            return { success: false, message: 'Solver error: ' + error.message };
        }
    }

    initializeAvailability() {
        const availability = {};
        
        // Create a 2D array of available slots for each day and hour
        this.days.forEach(day => {
            availability[day] = {};
            this.hours.forEach(hour => {
                availability[day][hour] = true;
            });
        });
        
        return availability;
    }

    backtrackScheduling(courses, schedule, teacherAvailability, courseIndex = 0) {
        // Base case: all courses have been scheduled
        if (courseIndex >= courses.length) {
            return { success: true, schedule };
        }
        
        const course = courses[courseIndex];
        
        // Determine available days (prefer course's preferred days if specified)
        const daysToTry = course.preferredDays && course.preferredDays.length > 0 
            ? course.preferredDays 
            : this.days;
            
        // Try each possible day and hour for this course
        for (const day of daysToTry) {
            // Check all possible starting hours
            for (let startHour = 8; startHour <= 17 - course.duration; startHour++) {
                // Check if all required hours are available for this teacher
                let canSchedule = true;
                
                for (let h = 0; h < course.duration; h++) {
                    const hour = startHour + h;
                    
                    // Skip if outside working hours or teacher not available
                    if (hour < 8 || hour >= 17 || !teacherAvailability[day][hour]) {
                        canSchedule = false;
                        break;
                    }
                }
                
                if (canSchedule) {
                    // Temporarily schedule this course
                    const tempSchedule = [...schedule];
                    const tempTeacherAvailability = JSON.parse(JSON.stringify(teacherAvailability));
                    
                    // Mark hours as used
                    for (let h = 0; h < course.duration; h++) {
                        const hour = startHour + h;
                        tempTeacherAvailability[day][hour] = false;
                        
                        tempSchedule.push({
                            course,
                            day,
                            hour,
                            duration: 1 // Each hour is represented as a separate slot
                        });
                    }
                    
                    // Recursively try to schedule the next course
                    const result = this.backtrackScheduling(
                        courses, 
                        tempSchedule,
                        tempTeacherAvailability,
                        courseIndex + 1
                    );
                    
                    if (result.success) {
                        return result;
                    }
                    // If not successful, the loop will continue to try other possibilities
                }
            }
        }
        
        // If no valid schedule was found
        return { success: false };
    }

    relaxedScheduling(courses) {
        // Sort courses by duration (longest first) and then by constraints
        const sortedCourses = [...courses].sort((a, b) => {
            // First sort by duration (descending)
            if (b.duration !== a.duration) {
                return b.duration - a.duration;
            }
            
            // Then by the number of preferred days (ascending - fewer constraints first)
            const aPreferredDays = a.preferredDays ? a.preferredDays.length : 0;
            const bPreferredDays = b.preferredDays ? b.preferredDays.length : 0;
            
            return aPreferredDays - bPreferredDays;
        });
        
        // Initialize an empty schedule and availability
        let schedule = [];
        const teacherAvailability = this.initializeAvailability();
        
        // Try to place each course
        for (const course of sortedCourses) {
            let placed = false;
            
            // Try preferred days first, then any day if needed
            const daysToTry = [
                ...(course.preferredDays || []),
                ...this.days.filter(day => !(course.preferredDays || []).includes(day))
            ];
            
            for (const day of daysToTry) {
                // Try to find consecutive available hours
                for (let startHour = 8; startHour <= 17 - course.duration; startHour++) {
                    let canSchedule = true;
                    
                    for (let h = 0; h < course.duration; h++) {
                        const hour = startHour + h;
                        if (!teacherAvailability[day][hour]) {
                            canSchedule = false;
                            break;
                        }
                    }
                    
                    if (canSchedule) {
                        // Schedule this course
                        for (let h = 0; h < course.duration; h++) {
                            const hour = startHour + h;
                            teacherAvailability[day][hour] = false;
                            
                            schedule.push({
                                course,
                                day,
                                hour,
                                duration: 1
                            });
                        }
                        
                        placed = true;
                        break;
                    }
                }
                
                if (placed) break;
            }
            
            // If we couldn't place the course normally, try to split it
            if (!placed && course.duration > 1) {
                placed = this.tryToSplitCourse(course, schedule, teacherAvailability);
            }
            
            // If still not placed, we've failed to create a schedule
            if (!placed) {
                return { success: false, message: `Could not place course ${course.code}` };
            }
        }
        
        return { success: true, schedule };
    }

    tryToSplitCourse(course, schedule, teacherAvailability) {
        // Try to find individual available slots
        let hoursPlaced = 0;
        const originalDuration = course.duration;
        const daysToTry = [...this.days]; // Try all days
        
        while (hoursPlaced < originalDuration && daysToTry.length > 0) {
            const dayIndex = Math.floor(Math.random() * daysToTry.length);
            const day = daysToTry[dayIndex];
            
            let placedOnThisDay = false;
            
            for (let hour = 8; hour < 17; hour++) {
                if (teacherAvailability[day][hour]) {
                    // Place one hour of the course
                    teacherAvailability[day][hour] = false;
                    
                    schedule.push({
                        course: { ...course, originalDuration: originalDuration },
                        day,
                        hour,
                        duration: 1,
                        isSplit: true
                    });
                    
                    hoursPlaced++;
                    placedOnThisDay = true;
                    
                    if (hoursPlaced >= originalDuration) {
                        break;
                    }
                }
            }
            
            if (!placedOnThisDay) {
                // Remove this day from consideration
                daysToTry.splice(dayIndex, 1);
            }
        }
        
        return hoursPlaced >= originalDuration;
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scheduleManager = new ScheduleManager();
});