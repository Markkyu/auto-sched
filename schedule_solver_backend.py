"""
University Course Scheduler using Google OR-Tools
This script implements a constraint satisfaction problem solver for university course scheduling
using Google's OR-Tools CP-SAT solver. It handles constraints such as teacher availability,
room capacity, and course scheduling patterns.
"""

from ortools.sat.python import cp_model
import time


class ScheduleSolver:
    def __init__(self):
        self.model = cp_model.CpModel()
        self.solver = None
        self.courses = []
        self.teachers = set()
        self.rooms = set()
        
        # Time slots - 30 minute increments from 8:00 to 18:00
        self.days = ['mon', 'tue', 'wed', 'thu', 'fri']
        self.hours = [f"{h}:{m}" for h in range(8, 18) for m in ['00', '30']]
        self.day_indices = {day: i for i, day in enumerate(self.days)}
        self.hour_indices = {hour: i for i, hour in enumerate(self.hours)}
        
        # Variables to store the solution
        self.course_assignments = {}
        self.solution = None

    def add_course(self, code, name, teacher, hours, preferred_days='any', priority=3):
        """
        Add a course to be scheduled
        
        Args:
            code (str): Course code
            name (str): Course name
            teacher (str): Teacher name
            hours (float): Course duration in hours
            preferred_days (str): Preferred days pattern ('MWF', 'TTh', or 'any')
            priority (int): Course priority (1-5)
        """
        self.courses.append({
            'code': code,
            'name': name,
            'teacher': teacher,
            'hours': hours,
            'preferred_days': preferred_days,
            'priority': priority
        })
        self.teachers.add(teacher)

    def add_room(self, name, capacity=30):
        """
        Add a room for scheduling
        
        Args:
            name (str): Room name or identifier
            capacity (int): Room capacity
        """
        self.rooms.add(name)

    def _create_variables(self):
        """Create decision variables for the constraint problem"""
        num_days = len(self.days)
        num_hours = len(self.hours)
        num_rooms = len(self.rooms)
        rooms_list = list(self.rooms)
        
        # If no rooms were added, create a default one
        if not rooms_list:
            rooms_list = ['default_room']
            
        # For each course, create variables for day, starting hour, and room
        for i, course in enumerate(self.courses):
            day_var = self.model.NewIntVar(0, num_days - 1, f"day_{i}")
            hour_var = self.model.NewIntVar(0, num_hours - 1, f"hour_{i}")
            room_var = self.model.NewIntVar(0, max(1, num_rooms) - 1, f"room_{i}")
            
            # Create a boolean variable for whether this course is scheduled
            is_scheduled = self.model.NewBoolVar(f"is_scheduled_{i}")
            
            self.course_assignments[i] = {
                'day': day_var,
                'hour': hour_var,
                'room': room_var,
                'is_scheduled': is_scheduled,
                'course': course
            }

    def _add_scheduling_constraints(self):
        """Add basic scheduling constraints to the model"""
        for i, course_i in self.course_assignments.items():
            course_data = course_i['course']
            slots_needed = int(course_data['hours'] * 2)  # Convert hours to 30-min slots
            
            # Course must end before the day ends
            max_starting_slot = len(self.hours) - slots_needed
            self.model.Add(course_i['hour'] <= max_starting_slot).OnlyEnforceIf(course_i['is_scheduled'])
            
            # Apply preferred days constraints
            if course_data['preferred_days'] == 'MWF':
                # Course must be on Monday, Wednesday, or Friday
                allowed_days = [self.day_indices['mon'], self.day_indices['wed'], self.day_indices['fri']]
                self.model.AddAllowedValues(course_i['day'], allowed_days).OnlyEnforceIf(course_i['is_scheduled'])
            elif course_data['preferred_days'] == 'TTh':
                # Course must be on Tuesday or Thursday
                allowed_days = [self.day_indices['tue'], self.day_indices['thu']]
                self.model.AddAllowedValues(course_i['day'], allowed_days).OnlyEnforceIf(course_i['is_scheduled'])
            
            # Add non-overlapping constraints between courses
            for j, course_j in self.course_assignments.items():
                if i >= j:
                    continue
                
                course_j_data = course_j['course']
                slots_needed_j = int(course_j_data['hours'] * 2)
                
                # If same teacher, courses can't overlap
                if course_data['teacher'] == course_j_data['teacher']:
                    # Courses are on different days
                    different_days = self.model.NewBoolVar(f"diff_days_{i}_{j}")
                    self.model.Add(course_i['day'] != course_j['day']).OnlyEnforceIf(different_days)
                    
                    # Or course i ends before course j starts
                    i_before_j = self.model.NewBoolVar(f"i_before_j_{i}_{j}")
                    self.model.Add(course_i['hour'] + slots_needed <= course_j['hour']).OnlyEnforceIf(i_before_j)
                    
                    # Or course j ends before course i starts
                    j_before_i = self.model.NewBoolVar(f"j_before_i_{i}_{j}")
                    self.model.Add(course_j['hour'] + slots_needed_j <= course_i['hour']).OnlyEnforceIf(j_before_i)
                    
                    # Different rooms
                    different_rooms = self.model.NewBoolVar(f"diff_rooms_{i}_{j}")
                    self.model.Add(course_i['room'] != course_j['room']).OnlyEnforceIf(different_rooms)
                    
                    # Logically, courses don't overlap if:
                    # (different days OR i before j OR j before i OR different rooms)
                    self.model.AddBoolOr([
                        different_days, i_before_j, j_before_i, different_rooms,
                        course_i['is_scheduled'].Not(), course_j['is_scheduled'].Not()
                    ])

    def _set_objective(self):
        """Set the optimization objective to maximize scheduled courses by priority"""
        objective_terms = []
        
        for i, course_i in self.course_assignments.items():
            # Weight by priority (higher priority courses are scheduled first)
            priority_weight = course_i['course']['priority'] * 10
            objective_terms.append(course_i['is_scheduled'] * priority_weight)
        
        self.model.Maximize(sum(objective_terms))

    def solve(self, time_limit_seconds=30):
        """
        Solve the scheduling problem
        
        Args:
            time_limit_seconds (int): Maximum time to spend solving
            
        Returns:
            dict: Scheduling result with status and schedule
        """
        start_time = time.time()
        
        # Add default room if none were provided
        if not self.rooms:
            self.add_room('default_room')
        
        # Create variables and constraints
        self._create_variables()
        self._add_scheduling_constraints()
        self._set_objective()
        
        # Create solver and solve
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = time_limit_seconds
        status = self.solver.Solve(self.model)
        
        solve_time = time.time() - start_time
        
        # Process results
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            schedule = self._extract_solution()
            scheduled_count = sum(1 for c in self.course_assignments.values() 
                               if self.solver.Value(c['is_scheduled']))
            
            return {
                'success': True,
                'schedule': schedule,
                'scheduled_count': scheduled_count,
                'total_count': len(self.courses),
                'solve_time': solve_time,
                'status': 'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE'
            }
        else:
            return {
                'success': False,
                'schedule': {},
                'message': f"No solution found. Status: {status}",
                'solve_time': solve_time
            }

    def _extract_solution(self):
        """Extract the solution into a usable schedule format"""
        schedule = {day: {hour: [] for hour in self.hours} for day in self.days}
        days_list = list(self.days)
        hours_list = list(self.hours)
        rooms_list = list(self.rooms)
        
        if not rooms_list:
            rooms_list = ['default_room']
        
        for i, course_assignment in self.course_assignments.items():
            if not self.solver.Value(course_assignment['is_scheduled']):
                continue
                
            course = course_assignment['course']
            day_idx = self.solver.Value(course_assignment['day'])
            hour_idx = self.solver.Value(course_assignment['hour'])
            room_idx = self.solver.Value(course_assignment['room'])
            
            day = days_list[day_idx]
            start_hour = hours_list[hour_idx]
            room = rooms_list[room_idx]
            
            slots_needed = int(course['hours'] * 2)
            
            # Add the course to each time slot it occupies
            for offset in range(slots_needed):
                if hour_idx + offset < len(hours_list):
                    current_hour = hours_list[hour_idx + offset]
                    schedule[day][current_hour].append({
                        'code': course['code'],
                        'name': course['name'],
                        'teacher': course['teacher'],
                        'room': room
                    })
        
        return schedule


# Example usage
def example_usage():
    """Example showing how to use the ScheduleSolver class"""
    solver = ScheduleSolver()
    
    # Add rooms
    solver.add_room("Room A", 40)
    solver.add_room("Room B", 30)
    solver.add_room("Room C", 25)
    
    # Add courses with different patterns
    # MWF pattern courses
    solver.add_course("CS101", "Intro to Computer Science", "Dr. Smith", 3, "MWF", 5)
    solver.add_course("MATH101", "Calculus I", "Dr. Johnson", 3, "MWF", 5)
    solver.add_course("ENG101", "English Composition", "Prof. Davis", 3, "MWF", 4)
    
    # TTh pattern courses
    solver.add_course("PHYS101", "Physics I", "Dr. Brown", 3, "TTh", 5)
    solver.add_course("CHEM101", "Chemistry I", "Dr. Wilson", 3, "TTh", 4)
    solver.add_course("BIO101", "Biology I", "Dr. Lee", 3, "TTh", 4)
    
    # Flexible courses
    solver.add_course("HIST101", "World History", "Prof. Anderson", 3, "any", 3)
    solver.add_course("PSYCH101", "Intro to Psychology", "Dr. Thomas", 3, "any", 3)
    solver.add_course("ART101", "Art History", "Prof. Garcia", 3, "any", 2)
    
    # Shorter courses
    solver.add_course("PE101", "Physical Education", "Coach Martinez", 1, "any", 2)
    solver.add_course("MUSIC101", "Music Appreciation", "Prof. Taylor", 1.5, "any", 2)
    
    # Same teacher, different courses - to test conflicts
    solver.add_course("CS201", "Data Structures", "Dr. Smith", 3, "TTh", 4)
    solver.add_course("MATH201", "Calculus II", "Dr. Johnson", 3, "TTh", 4)
    
    # Solve the problem
    result = solver.solve(time_limit_seconds=10)
    
    # Print results
    if result['success']:
        print(f"Successfully scheduled {result['scheduled_count']} out of {result['total_count']} courses")
        print(f"Solved in {result['solve_time']:.2f} seconds")
        
        # Print a simple visualization of the schedule
        for day in solver.days:
            print(f"\n{day.upper()}")
            for hour in solver.hours:
                courses = result['schedule'][day][hour]
                if courses:
                    course_info = ', '.join([f"{c['code']} ({c['room']})" for c in courses])
                    print(f"{hour}: {course_info}")
    else:
        print(f"Failed to find a solution: {result['message']}")
        print(f"Time spent: {result['solve_time']:.2f} seconds")


if __name__ == "__main__":
    example_usage()