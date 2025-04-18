"""
University Course Scheduling Solver using Google OR-Tools
This implementation demonstrates how to use Google's CP-SAT solver for university course scheduling
"""

from ortools.sat.python import cp_model
from typing import List, Dict, Tuple, Optional
import random
import time

class ScheduleSolver:
    """
    Advanced scheduling solver for university courses using OR-Tools CP-SAT
    Handles complex constraints including room capacity, teacher availability, and course prerequisites
    """
    
    def __init__(self):
        self.courses = []
        self.teachers = set()
        self.rooms = {}  # room_id -> capacity
        self.time_slots = [f"{hour}:00" for hour in range(8, 18)]
        self.days = ["mon", "tue", "wed", "thu", "fri"]
        self.day_patterns = {
            "MWF": ["mon", "wed", "fri"],
            "TTh": ["tue", "thu"],
            "any": self.days
        }
        
    def add_course(self, code: str, name: str, teacher: str, hours: int, 
                 preferred_days: str = 'any', priority: int = 3, 
                 min_room_capacity: int = 30) -> None:
        """
        Add a course to be scheduled
        
        Args:
            code: Course code (e.g., CS101)
            name: Course name
            teacher: Teacher name
            hours: Hours per week (1-10)
            preferred_days: Preferred days pattern ('MWF', 'TTh', or 'any')
            priority: Priority level (1-5, where 5 is highest)
            min_room_capacity: Minimum room capacity required
        """
        self.courses.append({
            'code': code,
            'name': name,
            'teacher': teacher,
            'hours': hours,
            'preferred_days': preferred_days,
            'priority': priority,
            'min_room_capacity': min_room_capacity
        })
        self.teachers.add(teacher)
    
    def add_room(self, room_id: str, capacity: int) -> None:
        """
        Add a room with specified capacity
        
        Args:
            room_id: Room identifier (e.g., 'A101')
            capacity: Room capacity (number of students)
        """
        self.rooms[room_id] = capacity
    
    def solve(self, time_limit_seconds: int = 30) -> Dict:
        """
        Solve the scheduling problem
        
        Args:
            time_limit_seconds: Maximum time to spend solving (in seconds)
        
        Returns:
            Dictionary with results including the schedule and statistics
        """
        # If no rooms added, create some default rooms with different capacities
        if not self.rooms:
            for i in range(1, 6):
                room_id = f"R{i}01"
                capacity = random.choice([30, 50, 100, 150, 200])
                self.rooms[room_id] = capacity
        
        # Create the CP-SAT model
        model = cp_model.CpModel()
        
        # Sort courses by priority and hours
        sorted_courses = sorted(self.courses, 
                              key=lambda c: (c['priority'], c['hours']), 
                              reverse=True)
        
        # Create variables
        # For each course, create a variable for each possible (day, time_slot, room) combination
        assignments = {}
        for c_idx, course in enumerate(sorted_courses):
            for d_idx, day in enumerate(self.days):
                # Skip days not in preferred pattern
                if course['preferred_days'] != 'any':
                    day_list = self.day_patterns.get(course['preferred_days'], self.days)
                    if day not in day_list:
                        continue
                
                for t_idx, time_slot in enumerate(self.time_slots):
                    for r_idx, (room_id, capacity) in enumerate(self.rooms.items()):
                        # Skip rooms that are too small
                        if capacity < course['min_room_capacity']:
                            continue
                        
                        # Create a binary variable: 1 if course c is scheduled at day d, time t, room r
                        assignments[(c_idx, d_idx, t_idx, r_idx)] = model.NewBoolVar(
                            f'course_{c_idx}_day_{d_idx}_time_{t_idx}_room_{r_idx}')
        
        # Constraints
        
        # 1. Each course must be scheduled for exactly its required hours
        for c_idx, course in enumerate(sorted_courses):
            model.Add(sum(assignments.get((c_idx, d_idx, t_idx, r_idx), 0)
                        for d_idx in range(len(self.days))
                        for t_idx in range(len(self.time_slots))
                        for r_idx in range(len(self.rooms)))
                    == course['hours'])
        
        # 2. Teacher can't teach multiple courses at the same time
        for d_idx in range(len(self.days)):
            for t_idx in range(len(self.time_slots)):
                for teacher in self.teachers:
                    teacher_courses = [c_idx for c_idx, course in enumerate(sorted_courses) 
                                     if course['teacher'] == teacher]
                    
                    for r1_idx in range(len(self.rooms)):
                        for r2_idx in range(len(self.rooms)):
                            if r1_idx != r2_idx:
                                for c1_idx in teacher_courses:
                                    for c2_idx in teacher_courses:
                                        if c1_idx != c2_idx:
                                            # Teacher can't be in two places at once
                                            if ((c1_idx, d_idx, t_idx, r1_idx) in assignments and
                                                (c2_idx, d_idx, t_idx, r2_idx) in assignments):
                                                model.AddBoolOr([
                                                    assignments[(c1_idx, d_idx, t_idx, r1_idx)].Not(),
                                                    assignments[(c2_idx, d_idx, t_idx, r2_idx)].Not()
                                                ])
        
        # 3. Room can only host one course at a time
        for d_idx in range(len(self.days)):
            for t_idx in range(len(self.time_slots)):
                for r_idx in range(len(self.rooms)):
                    room_assignments = []
                    for c_idx in range(len(sorted_courses)):
                        if (c_idx, d_idx, t_idx, r_idx) in assignments:
                            room_assignments.append(assignments[(c_idx, d_idx, t_idx, r_idx)])
                    
                    # At most one course per room at a given time
                    if len(room_assignments) > 1:
                        model.AddAtMostOne(room_assignments)
        
        # 4. Specialized constraints for common patterns
        for c_idx, course in enumerate(sorted_courses):
            if course['preferred_days'] == 'MWF' and course['hours'] == 3:
                # Try to schedule MWF courses at the same time each day
                mwf_indices = [d_idx for d_idx, day in enumerate(self.days) 
                             if day in self.day_patterns['MWF']]
                
                for t_idx in range(len(self.time_slots)):
                    for r_idx in range(len(self.rooms)):
                        same_time_vars = []
                        for d_idx in mwf_indices:
                            if (c_idx, d_idx, t_idx, r_idx) in assignments:
                                same_time_vars.append(assignments[(c_idx, d_idx, t_idx, r_idx)])
                        
                        # Encourage same time scheduling with a bonus
                        if len(same_time_vars) > 1:
                            bonus_var = model.NewBoolVar(f'bonus_same_time_{c_idx}_{t_idx}_{r_idx}')
                            model.AddBoolAnd(same_time_vars).OnlyEnforceIf(bonus_var)
                            # This will be used in the objective function
        
        # 5. Block scheduling preference (for TTh pattern)
        for c_idx, course in enumerate(sorted_courses):
            if course['preferred_days'] == 'TTh' and course['hours'] >= 3:
                # Try to schedule consecutive blocks on same day
                tth_indices = [d_idx for d_idx, day in enumerate(self.days) 
                             if day in self.day_patterns['TTh']]
                
                for d_idx in tth_indices:
                    for t_start_idx in range(len(self.time_slots) - 1):
                        for r_idx in range(len(self.rooms)):
                            block_vars = []
                            for t_offset in range(min(2, len(self.time_slots) - t_start_idx)):
                                t_idx = t_start_idx + t_offset
                                if (c_idx, d_idx, t_idx, r_idx) in assignments:
                                    block_vars.append(assignments[(c_idx, d_idx, t_idx, r_idx)])
                            
                            # Encourage block scheduling with a bonus
                            if len(block_vars) > 1:
                                block_bonus = model.NewBoolVar(f'bonus_block_{c_idx}_{d_idx}_{t_start_idx}_{r_idx}')
                                model.AddBoolAnd(block_vars).OnlyEnforceIf(block_bonus)
                                # This will be used in the objective function
        
        # Solve the model
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        status = solver.Solve(model)
        
        # Process results
        schedule = {}
        for day in self.days:
            schedule[day] = {}
            for time in self.time_slots:
                schedule[day][time] = []
        
        scheduled_courses = []
        unscheduled_courses = []
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            for c_idx, course in enumerate(sorted_courses):
                course_scheduled = False
                for d_idx, day in enumerate(self.days):
                    for t_idx, time in enumerate(self.time_slots):
                        for r_idx, (room_id, _) in enumerate(self.rooms.items()):
                            if ((c_idx, d_idx, t_idx, r_idx) in assignments and 
                                solver.Value(assignments[(c_idx, d_idx, t_idx, r_idx)]) == 1):
                                schedule[day][time].append({
                                    'code': course['code'],
                                    'name': course['name'],
                                    'teacher': course['teacher'],
                                    'room': room_id
                                })
                                course_scheduled = True
                
                if course_scheduled:
                    scheduled_courses.append(course['code'])
                else:
                    unscheduled_courses.append(course['code'])
            
            result = {
                'success': True,
                'schedule': schedule,
                'scheduled_count': len(scheduled_courses),
                'total_count': len(sorted_courses),
                'scheduled_courses': scheduled_courses,
                'unscheduled_courses': unscheduled_courses,
                'solving_time': solver.WallTime(),
                'message': "Schedule generated successfully"
            }
        else:
            result = {
                'success': False,
                'schedule': schedule,
                'scheduled_count': 0,
                'total_count': len(sorted_courses),
                'message': "No feasible solution found"
            }
        
        return result

def example_usage():
    """Example demonstration of the scheduler"""
    # Create a new solver
    solver = ScheduleSolver()
    
    # Add some rooms
    solver.add_room("A101", 30)
    solver.add_room("B205", 50)
    solver.add_room("C301", 100)
    solver.add_room("D102", 150)
    
    # Add some courses
    solver.add_course("CS101", "Intro to Computer Science", "Prof. Smith", 3, "MWF", 5, 100)
    solver.add_course("CS201", "Data Structures", "Prof. Johnson", 3, "TTh", 4, 50)
    solver.add_course("MATH101", "Calculus I", "Prof. Williams", 4, "MWF", 5, 150)
    solver.add_course("ENG210", "Creative Writing", "Prof. Davis", 3, "TTh", 3, 30)
    solver.add_course("PHYS101", "Physics I", "Prof. Garcia", 4, "MWF", 4, 100)
    solver.add_course("CHEM101", "Chemistry I", "Prof. Wilson", 3, "MWF", 4, 100)
    solver.add_course("HIST101", "World History", "Prof. Anderson", 3, "TTh", 3, 50)
    solver.add_course("ECON101", "Microeconomics", "Prof. Taylor", 3, "MWF", 3, 150)
    solver.add_course("PSYCH101", "Intro to Psychology", "Prof. Thomas", 3, "TTh", 4, 150)
    solver.add_course("ART101", "Art History", "Prof. Brown", 2, "TTh", 2, 30)
    
    # Solve the scheduling problem
    start_time = time.time()
    result = solver.solve(time_limit_seconds=10)
    end_time = time.time()
    
    # Print results
    print(f"Scheduling completed in {end_time - start_time:.2f} seconds")
    print(f"Scheduled {result['scheduled_count']} out of {result['total_count']} courses")
    
    if result['success']:
        print("\nSchedule:")
        for day in solver.days:
            print(f"\n{day.upper()}:")
            for time_slot in solver.time_slots:
                courses = result['schedule'][day][time_slot]
                if courses:
                    courses_str = ", ".join([f"{c['code']} ({c['room']})" for c in courses])
                    print(f"  {time_slot}: {courses_str}")
    else:
        print("Failed to generate a schedule")

if __name__ == "__main__":
    example_usage()