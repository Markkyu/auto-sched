"""
REST API for the University Course Scheduler
This Flask application provides REST endpoints for scheduling university courses
using the Google OR-Tools based scheduler implementation.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback
from schedule_solver_backend import ScheduleSolver

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "healthy", "message": "Schedule API is running"})

@app.route('/api/generate-schedule', methods=['POST'])
def generate_schedule():
    """
    Generate an optimized schedule based on provided courses and constraints
    
    Expected JSON request format:
    {
        "courses": [
            {
                "code": "CS101",
                "name": "Intro to Computer Science",
                "teacher": "Dr. Smith",
                "hours": 3,
                "preferred_days": "MWF",
                "priority": 5
            },
            ...
        ],
        "rooms": [
            {
                "name": "Room A",
                "capacity": 40
            },
            ...
        ],
        "time_limit_seconds": 30
    }
    
    Returns JSON response:
    {
        "success": true,
        "schedule": {
            "mon": {
                "8:00": [{"code": "CS101", "name": "...", "teacher": "...", "room": "..."}],
                ...
            },
            ...
        },
        "scheduled_count": 10,
        "total_count": 12,
        "solve_time": 2.5,
        "status": "OPTIMAL"
    }
    """
    try:
        data = request.json
        
        if not data or not isinstance(data, dict):
            return jsonify({"success": False, "message": "Invalid request format"}), 400
        
        # Validate request data
        if not data.get('courses') or not isinstance(data['courses'], list):
            return jsonify({"success": False, "message": "Courses data is required"}), 400
        
        # Initialize solver
        solver = ScheduleSolver()
        
        # Add rooms if provided
        if data.get('rooms') and isinstance(data['rooms'], list):
            for room in data['rooms']:
                solver.add_room(
                    name=room.get('name', 'Unknown Room'),
                    capacity=int(room.get('capacity', 30))
                )
        
        # Add courses
        for course in data['courses']:
            solver.add_course(
                code=course.get('code', 'Unknown'),
                name=course.get('name', 'Unknown Course'),
                teacher=course.get('teacher', 'Unknown Teacher'),
                hours=float(course.get('hours', 3)),
                preferred_days=course.get('preferred_days', 'any'),
                priority=int(course.get('priority', 3))
            )
        
        # Solve the scheduling problem
        time_limit = int(data.get('time_limit_seconds', 30))
        result = solver.solve(time_limit_seconds=time_limit)
        
        return jsonify(result)
    
    except Exception as e:
        # Log the error
        traceback.print_exc()
        return jsonify({
            "success": False,
            "message": f"Error generating schedule: {str(e)}"
        }), 500

@app.route('/api/examples/sample-schedule', methods=['GET'])
def sample_schedule():
    """
    Generate a sample schedule for demonstration purposes
    
    Returns a pre-defined sample schedule in the same format as the generate-schedule endpoint
    """
    solver = ScheduleSolver()
    
    # Add rooms
    solver.add_room("Room A", 40)
    solver.add_room("Room B", 30)
    
    # Add sample courses
    solver.add_course("CS101", "Intro to Computer Science", "Dr. Smith", 3, "MWF", 5)
    solver.add_course("MATH101", "Calculus I", "Dr. Johnson", 3, "MWF", 5)
    solver.add_course("PHYS101", "Physics I", "Dr. Brown", 3, "TTh", 5)
    solver.add_course("CHEM101", "Chemistry I", "Dr. Wilson", 3, "TTh", 4)
    solver.add_course("BIO101", "Biology I", "Dr. Lee", 3, "any", 4)
    
    # Solve with a short time limit for quick response
    result = solver.solve(time_limit_seconds=5)
    
    return jsonify(result)

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({"success": False, "message": "Endpoint not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    """Handle 405 errors"""
    return jsonify({"success": False, "message": "Method not allowed"}), 405

if __name__ == "__main__":
    # Run the application on port 5000 in debug mode
    # In production, you should use a proper WSGI server like gunicorn
    # Example: gunicorn -w 4 schedule_api:app
    app.run(debug=True)