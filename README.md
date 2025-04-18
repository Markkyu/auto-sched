# University Course Scheduler

An advanced university course scheduling system that uses constraint satisfaction and optimization techniques to create conflict-free timetables.

## Features

- **Advanced Scheduling Algorithm**: Uses Google's OR-Tools CP-SAT solver to handle complex scheduling constraints
- **RESTful API**: Flask-based API for easy integration with any frontend
- **Constraint Handling**: Manages room capacities, teacher availability, course prerequisites, and more
- **Flexible Time Slots**: Supports MWF and TTh scheduling patterns with customizable time blocks
- **Optimization**: Prioritizes courses based on importance and student needs
- **Web Interface**: Optional HTML/JS interface for manual scheduling

## Requirements

- Python 3.7+
- Google OR-Tools
- Flask & Flask-CORS (for API)
- Additional dependencies listed in requirements.txt

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Markkyu/auto-sched.git
   cd auto-sched
   ```

2. Create a virtual environment (recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

### Running the Scheduling API

1. Start the Flask API server:
   ```
   python schedule_api.py
   ```

   For production deployment, use Gunicorn:
   ```
   gunicorn -w 4 schedule_api:app
   ```

2. The API will be available at `http://localhost:5000`

### API Endpoints

- `GET /api/health` - Check if API is running
- `POST /api/generate-schedule` - Generate an optimized schedule (see API docs for JSON format)
- `POST /api/validate-input` - Validate input data before scheduling
- `GET /api/examples/demo-schedule` - Get sample data for testing

### Using the Scheduler as a Library

You can also use the scheduling engine directly in your Python code:

```python
from schedule_solver_backend import ScheduleSolver

# Create a solver instance
solver = ScheduleSolver()

# Add rooms
solver.add_room("A101", 30)
solver.add_room("B205", 50)

# Add courses
solver.add_course(
    code="CS101",
    name="Introduction to Computer Science",
    teacher="Prof. Smith",
    hours=3,
    preferred_days="MWF",
    min_room_capacity=30
)

# Solve the scheduling problem
result = solver.solve(time_limit_seconds=30)

# Print the schedule
for course_code, assignments in result['schedule'].items():
    print(f"Course: {course_code}")
    for assignment in assignments:
        print(f"  Day: {assignment['day']}, Time: {assignment['time']}, Room: {assignment['room']}")
```

## Web Interface

The project includes a simple HTML/JS interface for manual scheduling:

1. Open `generate-schedule.html` in a web browser
2. Add courses with their constraints
3. Click "Generate Schedule" to create a timetable

The interface can work in two modes:
- Local mode (JavaScript-based scheduling for simple cases)
- API mode (connects to the Python backend for advanced scheduling)

## Extending the System

### Adding New Constraints

To add new constraints to the scheduling model, modify the `solve()` method in `schedule_solver_backend.py`:

1. Define new decision variables for your constraint
2. Add the constraint logic to the model using `model.Add()`
3. Update the objective function if needed

### Customizing the API

The Flask API can be extended with new endpoints by modifying `schedule_api.py`:

1. Use Flask's `@app.route()` decorator to define new endpoints
2. Process incoming data and call appropriate scheduler methods
3. Return results as JSON responses

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.