"""
University Course Scheduler using Google OR-Tools

This module implements a constraint satisfaction approach to university course scheduling
using Google's OR-Tools CP-SAT solver. It handles complex constraints such as:
- Room capacity requirements
- Teacher availability
- Course hours and patterns (MWF vs TTh)
- Time slot preferences
- Department-specific constraints

Author: Mark
"""

from ortools.sat.python import cp_model
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ScheduleSolver:
    """Handles university course scheduling using constraint programming."""
    
    def __init__(self):
        """Initialize the scheduler with empty containers for courses, rooms, and constraints."""
        self.courses = {}
        self.rooms = {}
        self.teachers = set()
        self.departments = {}
        
        # Define standard time slots
        self.mwf_slots = [
            "08:00-08:50", "09:00-09:50", "10:00-10:50", "11:00-11:50",
            "12:00-12:50", "13:00-13:50", "14:00-14:50", "15:00-15:50",
            "16:00-16:50", "17:00-17:50"
        ]
        
        self.tth_slots = [
            "08:00-09:15", "09:30-10:45", "11:00-12:15", "12:30-13:45",
            "14:00-15:15", "15:30-16:45", "17:00-18:15"
        ]
        
        self.days = {
            "MWF": ["Monday", "Wednesday", "Friday"],
            "TTh": ["Tuesday", "Thursday"]
        }

    def add_course(self, code, name, teacher, hours, preferred_days=None, 
                  min_room_capacity=0, department=None, priority=1):
        """
        Add a course to be scheduled.
        
        Args:
            code: Course code (e.g., 'CS101')
            name: Course name
            teacher: Teacher's name
            hours: Number of hours per week (typically 3)
            preferred_days: 'MWF' or 'TTh' or None for any
            min_room_capacity: Minimum required room capacity
            department: Department code for department-specific constraints
            priority: Priority level (1-10, higher means more important to schedule)
        """
        self.courses[code] = {
            'name': name,
            'teacher': teacher,
            'hours': hours,
            'preferred_days': preferred_days,
            'min_room_capacity': min_room_capacity,
            'department': department,
            'priority': priority
        }
        
        self.teachers.add(teacher)
        
        if department:
            if department not in self.departments:
                self.departments[department] = []
            self.departments[department].append(code)
            
        logger.info(f"Added course: {code} - {name} taught by {teacher}")
        
    def add_room(self, room_id, capacity, features=None):
        """
        Add a room that can be used for scheduling.
        
        Args:
            room_id: Room identifier (e.g., 'A101')
            capacity: Room capacity (number of seats)
            features: List of special features the room has
        """
        self.rooms[room_id] = {
            'capacity': capacity,
            'features': features or []
        }
        logger.info(f"Added room: {room_id} with capacity {capacity}")
        
    def solve(self, time_limit_seconds=60):
        """
        Solve the scheduling problem using CP-SAT solver.
        
        Args:
            time_limit_seconds: Maximum time to spend solving
            
        Returns:
            Dictionary with schedule and statistics
        """
        start_time = time.time()
        
        # Create the CP-SAT model
        model = cp_model.CpModel()
        
        # If no courses or rooms, return empty schedule
        if not self.courses or not self.rooms:
            logger.warning("No courses or rooms defined")
            return {'schedule': {}, 'stats': {'status': 'No courses or rooms defined'}}
        
        # Create variables
        course_vars = {}
        
        # For each course, create decision variables for day, time slot, and room
        for course_code in self.courses:
            course = self.courses[course_code]
            
            # Determine which pattern this course follows (MWF or TTh)
            pattern = course['preferred_days'] if course['preferred_days'] else "ANY"
            
            # Create variables for each possible assignment
            course_vars[course_code] = {}
            
            # Handle MWF pattern (or ANY)
            if pattern in ["MWF", "ANY"]:
                for time_idx, time_slot in enumerate(self.mwf_slots):
                    for day in self.days["MWF"]:
                        for room_id in self.rooms:
                            # Only consider rooms with sufficient capacity
                            if self.rooms[room_id]['capacity'] >= course['min_room_capacity']:
                                var_name = f"{course_code}_{day}_{time_slot}_{room_id}"
                                course_vars[course_code][(day, time_slot, room_id)] = model.NewBoolVar(var_name)
            
            # Handle TTh pattern (or ANY)
            if pattern in ["TTh", "ANY"]:
                for time_idx, time_slot in enumerate(self.tth_slots):
                    for day in self.days["TTh"]:
                        for room_id in self.rooms:
                            # Only consider rooms with sufficient capacity
                            if self.rooms[room_id]['capacity'] >= course['min_room_capacity']:
                                var_name = f"{course_code}_{day}_{time_slot}_{room_id}"
                                course_vars[course_code][(day, time_slot, room_id)] = model.NewBoolVar(var_name)
        
        # Each course must be scheduled exactly once
        for course_code, vars_dict in course_vars.items():
            model.Add(sum(vars_dict.values()) == 1)
        
        # A room cannot be double-booked
        for time_slot in self.mwf_slots:
            for day in self.days["MWF"]:
                for room_id in self.rooms:
                    room_booked_vars = []
                    for course_code, vars_dict in course_vars.items():
                        for (d, t, r), var in vars_dict.items():
                            if d == day and t == time_slot and r == room_id:
                                room_booked_vars.append(var)
                    if room_booked_vars:
                        model.Add(sum(room_booked_vars) <= 1)
        
        for time_slot in self.tth_slots:
            for day in self.days["TTh"]:
                for room_id in self.rooms:
                    room_booked_vars = []
                    for course_code, vars_dict in course_vars.items():
                        for (d, t, r), var in vars_dict.items():
                            if d == day and t == time_slot and r == room_id:
                                room_booked_vars.append(var)
                    if room_booked_vars:
                        model.Add(sum(room_booked_vars) <= 1)
        
        # A teacher cannot teach two courses at the same time
        for teacher in self.teachers:
            # Get all courses taught by this teacher
            teacher_courses = [c for c, details in self.courses.items() 
                               if details['teacher'] == teacher]
            
            # Check MWF time slots
            for time_slot in self.mwf_slots:
                for day in self.days["MWF"]:
                    teacher_vars = []
                    for course_code in teacher_courses:
                        for (d, t, r), var in course_vars[course_code].items():
                            if d == day and t == time_slot:
                                teacher_vars.append(var)
                    if teacher_vars:
                        model.Add(sum(teacher_vars) <= 1)
            
            # Check TTh time slots
            for time_slot in self.tth_slots:
                for day in self.days["TTh"]:
                    teacher_vars = []
                    for course_code in teacher_courses:
                        for (d, t, r), var in course_vars[course_code].items():
                            if d == day and t == time_slot:
                                teacher_vars.append(var)
                    if teacher_vars:
                        model.Add(sum(teacher_vars) <= 1)
        
        # Departments may have specific constraints (e.g., no department has all its courses at the same time)
        for dept, course_codes in self.departments.items():
            if len(course_codes) > 1:  # Only relevant if department has multiple courses
                # Ensure department courses are spread throughout the day
                for time_slot in self.mwf_slots:
                    for day in self.days["MWF"]:
                        dept_vars = []
                        for course_code in course_codes:
                            for (d, t, r), var in course_vars[course_code].items():
                                if d == day and t == time_slot:
                                    dept_vars.append(var)
                        if dept_vars:
                            model.Add(sum(dept_vars) <= 1)  # At most one course per department per time slot
                
                for time_slot in self.tth_slots:
                    for day in self.days["TTh"]:
                        dept_vars = []
                        for course_code in course_codes:
                            for (d, t, r), var in course_vars[course_code].items():
                                if d == day and t == time_slot:
                                    dept_vars.append(var)
                        if dept_vars:
                            model.Add(sum(dept_vars) <= 1)  # At most one course per department per time slot
        
        # Objective: maximize priority-weighted assignments
        objective_terms = []
        for course_code, vars_dict in course_vars.items():
            priority = self.courses[course_code]['priority']
            for var in vars_dict.values():
                objective_terms.append(priority * var)
        
        model.Maximize(sum(objective_terms))
        
        # Create solver and solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        
        # Add solution callback to store all solutions found
        status = solver.Solve(model)
        
        # Process results
        schedule = {}
        stats = {
            'status': solver.StatusName(status),
            'solve_time': time.time() - start_time,
            'branches': solver.NumBranches(),
            'conflicts': solver.NumConflicts(),
            'objective_value': solver.ObjectiveValue() if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE else None
        }
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            for course_code, vars_dict in course_vars.items():
                schedule[course_code] = []
                for (day, time_slot, room_id), var in vars_dict.items():
                    if solver.Value(var) == 1:
                        schedule[course_code].append({
                            'day': day,
                            'time': time_slot,
                            'room': room_id
                        })
                        logger.info(f"Scheduled {course_code} on {day} at {time_slot} in room {room_id}")
            
            logger.info(f"Schedule successfully generated. "
                       f"Status: {stats['status']}, "
                       f"Time: {stats['solve_time']:.2f}s, "
                       f"Objective: {stats['objective_value']}")
        else:
            logger.warning(f"Could not find a valid schedule. Status: {stats['status']}")
        
        return {
            'schedule': schedule,
            'stats': stats
        }

def example_usage():
    """Example of how to use the ScheduleSolver."""
    solver = ScheduleSolver()
    
    # Add rooms
    solver.add_room("A101", 30)
    solver.add_room("B205", 50)
    solver.add_room("C110", 100)
    solver.add_room("D202", 25)
    
    # Add courses
    solver.add_course(
        code="CS101",
        name="Introduction to Computer Science",
        teacher="Prof. Smith",
        hours=3,
        preferred_days="MWF",
        min_room_capacity=30,
        department="CS",
        priority=5
    )
    
    solver.add_course(
        code="CS201",
        name="Data Structures",
        teacher="Prof. Jones",
        hours=3,
        preferred_days="TTh",
        min_room_capacity=25,
        department="CS",
        priority=4
    )
    
    solver.add_course(
        code="MATH101",
        name="Calculus I",
        teacher="Prof. Brown",
        hours=3,
        preferred_days="MWF",
        min_room_capacity=100,
        department="MATH",
        priority=5
    )
    
    solver.add_course(
        code="ENG210",
        name="Technical Writing",
        teacher="Prof. Smith",  # Note: Same teacher as CS101
        hours=3,
        preferred_days="TTh",
        min_room_capacity=25,
        department="ENG",
        priority=3
    )
    
    # Solve the scheduling problem
    result = solver.solve(time_limit_seconds=30)
    
    # Print the schedule
    if result['stats']['status'] in ['OPTIMAL', 'FEASIBLE']:
        print("\nGenerated Schedule:")
        print("-" * 50)
        for course_code, assignments in result['schedule'].items():
            course = solver.courses[course_code]
            print(f"Course: {course_code} - {course['name']}")
            print(f"Teacher: {course['teacher']}")
            for assignment in assignments:
                print(f"  Day: {assignment['day']}, Time: {assignment['time']}, Room: {assignment['room']}")
            print()
    else:
        print(f"No schedule could be generated. Status: {result['stats']['status']}")

    return result

if __name__ == "__main__":
    print("University Course Scheduler")
    print("==========================")
    example_usage()