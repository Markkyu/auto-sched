/**
 * Auto-Sched - University Course Scheduling Application
 * Main JavaScript file for handling application logic
 */

// Global state for the application
const state = {
    courseQueue: [],
    generatedSchedule: null,
    currentStep: 1,
    maxSteps: 3
};

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Form elements
    const courseForm = document.getElementById('course-form');
    const courseCodeInput = document.getElementById('course-code');
    const courseNameInput = document.getElementById('course-name');
    const teacherInput = document.getElementById('teacher');
    const durationInput = document.getElementById('duration');
    const preferredDaysInput = document.getElementById('preferred-days');
    const preferredTimeInput = document.getElementById('preferred-time');
    
    // Queue elements
    const courseQueueList = document.getElementById('course-queue-list');
    const generateScheduleBtn = document.getElementById('generate-schedule');
    const clearQueueBtn = document.getElementById('clear-queue');
    
    // Schedule elements
    const scheduleTable = document.getElementById('schedule-table');
    const exportScheduleBtn = document.getElementById('export-schedule');
    const regenerateBtn = document.getElementById('regenerate-schedule');
    const statusContainer = document.getElementById('status-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    
    // Workflow steps
    const workflowSteps = document.querySelectorAll('.workflow-step');
    
    // Initialize event listeners
    initEventListeners();
    
    // Update UI based on initial state
    updateUI();
    
    // Functions
    function initEventListeners() {
        // Form submission for adding courses
        courseForm.addEventListener('submit', handleAddCourse);
        
        // Queue management
        clearQueueBtn.addEventListener('click', handleClearQueue);
        generateScheduleBtn.addEventListener('click', handleGenerateSchedule);
        
        // Schedule management
        regenerateBtn.addEventListener('click', handleRegenerateSchedule);
        exportScheduleBtn.addEventListener('click', handleExportSchedule);
    }
    
    function handleAddCourse(event) {
        event.preventDefault();
        
        // Validate form
        if (!validateCourseForm()) return;
        
        // Create course object
        const newCourse = {
            id: Date.now(), // Unique ID
            code: courseCodeInput.value,
            name: courseNameInput.value,
            teacher: teacherInput.value,
            duration: parseInt(durationInput.value),
            preferredDays: preferredDaysInput.value,
            preferredTime: preferredTimeInput.value
        };
        
        // Add to queue
        state.courseQueue.push(newCourse);
        
        // Reset form
        courseForm.reset();
        
        // Update UI
        updateUI();
        
        // Progress to step 2 if this is the first course
        if (state.courseQueue.length === 1) {
            advanceStep(2);
        }
    }
    
    function validateCourseForm() {
        // Simple validation - could be expanded
        if (!courseCodeInput.value || !courseNameInput.value || !teacherInput.value) {
            showStatus('Please fill in all required fields', 'error');
            return false;
        }
        return true;
    }
    
    function handleClearQueue() {
        if (confirm('Are you sure you want to clear the course queue?')) {
            state.courseQueue = [];
            state.generatedSchedule = null;
            updateUI();
            advanceStep(1);
        }
    }
    
    function handleGenerateSchedule() {
        if (state.courseQueue.length < 1) {
            showStatus('Please add at least one course to generate a schedule', 'error');
            return;
        }
        
        // Show loading indicator
        loadingIndicator.classList.remove('hidden');
        
        // Simulate API call (replace with actual solver when ready)
        setTimeout(() => {
            try {
                state.generatedSchedule = generateScheduleWithSolver(state.courseQueue);
                advanceStep(3);
                showStatus('Schedule generated successfully!', 'success');
            } catch (error) {
                showStatus('Failed to generate schedule: ' + error.message, 'error');
            } finally {
                loadingIndicator.classList.add('hidden');
                updateUI();
            }
        }, 1500);
    }
    
    function handleRegenerateSchedule() {
        handleGenerateSchedule();
    }
    
    function handleExportSchedule() {
        if (!state.generatedSchedule) {
            showStatus('No schedule to export', 'error');
            return;
        }
        
        // Create CSV content
        let csvContent = "Course Code,Course Name,Teacher,Day,Time\\n";
        
        state.generatedSchedule.forEach(slot => {
            if (slot.course) {
                csvContent += `${slot.course.code},${slot.course.name},${slot.course.teacher},${slot.day},${slot.time}\\n`;
            }
        });
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'schedule.csv');
        a.click();
    }
    
    function advanceStep(step) {
        state.currentStep = step;
        updateWorkflowUI();
    }
    
    function updateWorkflowUI() {
        workflowSteps.forEach((stepEl, index) => {
            const stepNum = index + 1;
            
            // Remove all classes first
            stepEl.classList.remove('active', 'completed');
            
            // Add appropriate class
            if (stepNum === state.currentStep) {
                stepEl.classList.add('active');
            } else if (stepNum < state.currentStep) {
                stepEl.classList.add('completed');
            }
        });
    }
    
    function updateUI() {
        // Update course queue
        updateCourseQueueUI();
        
        // Update schedule if available
        if (state.generatedSchedule) {
            updateScheduleUI();
        }
        
        // Update button states
        generateScheduleBtn.disabled = state.courseQueue.length === 0;
        clearQueueBtn.disabled = state.courseQueue.length === 0;
        exportScheduleBtn.disabled = !state.generatedSchedule;
        regenerateBtn.disabled = state.courseQueue.length === 0;
    }
    
    function updateCourseQueueUI() {
        // Clear existing list
        courseQueueList.innerHTML = '';
        
        // Add each course
        state.courseQueue.forEach(course => {
            const li = document.createElement('li');
            
            li.innerHTML = `
                <div class="course-info">
                    <h3>${course.code}: ${course.name}</h3>
                    <p>Teacher: ${course.teacher} | Duration: ${course.duration}hr | Preferred: ${course.preferredDays}, ${course.preferredTime}</p>
                </div>
                <button class="btn btn-text remove-course" data-id="${course.id}">
                    <span class="material-icons">delete</span>
                </button>
            `;
            
            courseQueueList.appendChild(li);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-course').forEach(button => {
            button.addEventListener('click', (e) => {
                const courseId = parseInt(e.currentTarget.dataset.id);
                removeCourseFromQueue(courseId);
            });
        });
    }
    
    function removeCourseFromQueue(courseId) {
        state.courseQueue = state.courseQueue.filter(course => course.id !== courseId);
        updateUI();
        
        if (state.courseQueue.length === 0) {
            advanceStep(1);
            state.generatedSchedule = null;
        }
    }
    
    function updateScheduleUI() {
        // Clear schedule table rows except header
        const tableBody = scheduleTable.querySelector('tbody');
        tableBody.innerHTML = '';
        
        // Time slots (8am to 8pm with 1 hour intervals)
        const timeSlots = [
            '8:00 - 9:00', '9:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
            '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
            '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00'
        ];
        
        // Create a row for each time slot
        timeSlots.forEach(timeSlot => {
            const row = document.createElement('tr');
            
            // Add time cell
            const timeCell = document.createElement('th');
            timeCell.textContent = timeSlot;
            row.appendChild(timeCell);
            
            // Add a cell for each day
            ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
                const cell = document.createElement('td');
                
                // Find course for this day and time
                const scheduledCourse = findCourseForDayAndTime(day, timeSlot);
                
                if (scheduledCourse) {
                    cell.classList.add('course-cell');
                    cell.innerHTML = `
                        <strong>${scheduledCourse.code}</strong><br>
                        ${scheduledCourse.name}<br>
                        <small>${scheduledCourse.teacher}</small>
                    `;
                }
                
                row.appendChild(cell);
            });
            
            tableBody.appendChild(row);
        });
    }
    
    function findCourseForDayAndTime(day, timeSlot) {
        if (!state.generatedSchedule) return null;
        
        const slot = state.generatedSchedule.find(s => 
            s.day === day && s.time === timeSlot && s.course
        );
        
        return slot ? slot.course : null;
    }
    
    function showStatus(message, type) {
        const statusEl = document.createElement('div');
        statusEl.className = `status-message status-${type}`;
        statusEl.textContent = message;
        
        // Clear previous messages
        statusContainer.innerHTML = '';
        statusContainer.appendChild(statusEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            statusEl.remove();
        }, 5000);
    }
});

/**
 * Scheduling Algorithm
 * This is a simplified version of a constraint satisfaction algorithm
 * For a more complex implementation, consider using a dedicated solver like OR-Tools
 */
function generateScheduleWithSolver(courses) {
    // Create a schedule grid
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = [
        '8:00 - 9:00', '9:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
        '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
        '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00'
    ];
    
    // Initialize empty schedule
    const schedule = [];
    days.forEach(day => {
        timeSlots.forEach(time => {
            schedule.push({ day, time, course: null });
        });
    });
    
    // Apply preferred times if possible, otherwise find any available slot
    for (const course of courses) {
        let placed = false;
        
        // Try to place according to preferences
        if (course.preferredDays && course.preferredTime) {
            const preferredDays = translatePreferredDays(course.preferredDays);
            const preferredTimeSlot = findTimeSlot(timeSlots, course.preferredTime);
            
            // Try each preferred day
            for (const preferredDay of preferredDays) {
                if (placed) break;
                
                // Find the starting index for the preferred time
                const startIndex = schedule.findIndex(slot => 
                    slot.day === preferredDay && slot.time === preferredTimeSlot
                );
                
                if (startIndex >= 0) {
                    // Check if we have enough consecutive slots
                    if (canPlaceCourse(schedule, startIndex, course.duration)) {
                        placeCourse(schedule, startIndex, course);
                        placed = true;
                    }
                }
            }
        }
        
        // If not placed according to preferences, try any available slot
        if (!placed) {
            // Try each day
            for (const day of days) {
                if (placed) break;
                
                // Try each time slot
                for (let i = 0; i < timeSlots.length; i++) {
                    const startIndex = schedule.findIndex(slot => 
                        slot.day === day && slot.time === timeSlots[i]
                    );
                    
                    if (startIndex >= 0) {
                        if (canPlaceCourse(schedule, startIndex, course.duration)) {
                            placeCourse(schedule, startIndex, course);
                            placed = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // If still not placed, throw an error (could be improved to be more user-friendly)
        if (!placed) {
            throw new Error(`Could not place course ${course.code} in the schedule`);
        }
    }
    
    return schedule;
}

function translatePreferredDays(preferredDays) {
    switch (preferredDays) {
        case 'MWF':
            return ['Monday', 'Wednesday', 'Friday'];
        case 'TTh':
            return ['Tuesday', 'Thursday'];
        case 'Any':
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        default:
            return [preferredDays]; // Assume it's a single day
    }
}

function findTimeSlot(timeSlots, preferredTime) {
    // Handle different formats of preferred time
    if (preferredTime === 'Morning') {
        return timeSlots[0]; // Start with 8am
    } else if (preferredTime === 'Afternoon') {
        return timeSlots[5]; // Start with 1pm
    } else if (preferredTime === 'Evening') {
        return timeSlots[9]; // Start with 5pm
    } else {
        // Assume it's a specific time in the format "HH:MM"
        const hour = parseInt(preferredTime.split(':')[0]);
        const matchingSlot = timeSlots.find(slot => slot.startsWith(`${hour}:`));
        return matchingSlot || timeSlots[0]; // Default to first slot if not found
    }
}

function canPlaceCourse(schedule, startIndex, duration) {
    const day = schedule[startIndex].day;
    
    // Check if we have enough consecutive slots for this day
    for (let i = 0; i < duration; i++) {
        const currentIndex = startIndex + i;
        
        // Make sure we haven't gone past the end of the array
        if (currentIndex >= schedule.length) return false;
        
        // Make sure we're still on the same day
        if (schedule[currentIndex].day !== day) return false;
        
        // Make sure the slot is available
        if (schedule[currentIndex].course !== null) return false;
    }
    
    return true;
}

function placeCourse(schedule, startIndex, course) {
    const day = schedule[startIndex].day;
    
    // Place the course in the required number of slots
    for (let i = 0; i < course.duration; i++) {
        const currentIndex = startIndex + i;
        schedule[currentIndex].course = course;
    }
}