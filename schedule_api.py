"""
RESTful API for university course scheduling using OR-Tools
This Flask application exposes the scheduling functionality as a web service
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import traceback
import time
from schedule_solver_backend import ScheduleSolver

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

@app.route('/api/health', methods=['GET'])
def health_check():
    """Basic health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': time.time(),
        'message': 'Schedule API is running'
    }), 200

@app.route('/api/generate-schedule', methods=['POST'])
def generate_schedule():
    """
    Generate an optimized schedule based on provided courses and constraints
    
    Expected JSON format:
    {
        "courses": [
            {
                "code": "CS101",
                "name": "Introduction to Computer Science",
                "teacher": "Prof. Smith",
                "hours": 3,
                "preferred_days": "MWF",
                "priority": 5,
                "min_room_capacity": 100
            },
            ...
        ],
        "rooms": [
            {"id": "A101", "capacity": 30},
            {"id": "B205", "capacity": 50},
            ...
        ],
        "time_limit_seconds": 30
    }
    """
    try:
        # Parse request data
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # Initialize solver
        solver = ScheduleSolver()
        
        # Add rooms (if provided)
        if 'rooms' in data and data['rooms']:
            for room in data['rooms']:
                solver.add_room(room['id'], room['capacity'])
        
        # Add courses
        if 'courses' not in data or not data['courses']:
            return jsonify({
                'success': False,
                'message': 'No courses provided'
            }), 400
        
        for course in data['courses']:
            solver.add_course(
                code=course['code'],
                name=course['name'],
                teacher=course['teacher'],
                hours=course['hours'],
                preferred_days=course.get('preferred_days', 'any'),
                priority=course.get('priority', 3),
                min_room_capacity=course.get('min_room_capacity', 30)
            )
        
        # Set time limit (with reasonable default)
        time_limit = data.get('time_limit_seconds', 30)
        
        # Generate schedule
        start_time = time.time()
        result = solver.solve(time_limit_seconds=time_limit)
        end_time = time.time()
        
        # Add extra metadata
        result['processing_time'] = end_time - start_time
        result['api_version'] = '1.0'
        
        return jsonify(result), 200
    
    except Exception as e:
        # Log the error (would go to application logs)
        print(f"Error generating schedule: {str(e)}")
        print(traceback.format_exc())
        
        return jsonify({
            'success': False,
            'message': f'Error generating schedule: {str(e)}',
            'error_type': type(e).__name__
        }), 500

@app.route('/api/validate-input', methods=['POST'])
def validate_input():
    """
    Validate input data without generating a full schedule
    Useful for checking if the courses and constraints are properly formatted
    """
    try:
        data = request.json
        if not data:
            return jsonify({
                'valid': False,
                'message': 'No data provided'
            }), 400
        
        # Validate courses
        if 'courses' not in data or not data['courses']:
            return jsonify({
                'valid': False,
                'message': 'No courses provided'
            }), 400
        
        issues = []
        for i, course in enumerate(data['courses']):
            required_fields = ['code', 'name', 'teacher', 'hours']
            for field in required_fields:
                if field not in course:
                    issues.append(f"Course {i+1} is missing required field: {field}")
            
            if 'hours' in course and (not isinstance(course['hours'], int) or course['hours'] < 1 or course['hours'] > 10):
                issues.append(f"Course {i+1} ({course.get('code', 'unknown')}): Hours must be an integer between 1 and 10")
            
            if 'preferred_days' in course and course['preferred_days'] not in ['MWF', 'TTh', 'any']:
                issues.append(f"Course {i+1} ({course.get('code', 'unknown')}): Preferred days must be 'MWF', 'TTh', or 'any'")
        
        # Validate rooms (if provided)
        if 'rooms' in data and data['rooms']:
            for i, room in enumerate(data['rooms']):
                if 'id' not in room:
                    issues.append(f"Room {i+1} is missing required field: id")
                if 'capacity' not in room:
                    issues.append(f"Room {i+1} is missing required field: capacity")
                elif not isinstance(room['capacity'], int) or room['capacity'] < 1:
                    issues.append(f"Room {i+1} ({room.get('id', 'unknown')}): Capacity must be a positive integer")
        
        if issues:
            return jsonify({
                'valid': False,
                'issues': issues
            }), 400
        
        return jsonify({
            'valid': True,
            'message': 'Input data is valid'
        }), 200
    
    except Exception as e:
        return jsonify({
            'valid': False,
            'message': f'Error validating input: {str(e)}'
        }), 500

@app.route('/api/examples/demo-schedule', methods=['GET'])
def demo_schedule():
    """Return a demo schedule configuration that can be used for testing"""
    demo_data = {
        "courses": [
            {
                "code": "CS101",
                "name": "Introduction to Computer Science",
                "teacher": "Prof. Smith",
                "hours": 3,
                "preferred_days": "MWF",
                "priority": 5,
                "min_room_capacity": 100
            },
            {
                "code": "CS201",
                "name": "Data Structures",
                "teacher": "Prof. Johnson",
                "hours": 3,
                "preferred_days": "TTh",
                "priority": 4,
                "min_room_capacity": 50
            },
            {
                "code": "MATH101",
                "name": "Calculus I",
                "teacher": "Prof. Williams",
                "hours": 4,
                "preferred_days": "MWF",
                "priority": 5,
                "min_room_capacity": 150
            },
            {
                "code": "ENG210",
                "name": "Creative Writing",
                "teacher": "Prof. Davis",
                "hours": 3,
                "preferred_days": "TTh",
                "priority": 3,
                "min_room_capacity": 30
            },
            {
                "code": "PHYS101",
                "name": "Physics I",
                "teacher": "Prof. Garcia",
                "hours": 4,
                "preferred_days": "MWF",
                "priority": 4,
                "min_room_capacity": 100
            }
        ],
        "rooms": [
            {"id": "A101", "capacity": 30},
            {"id": "B205", "capacity": 50},
            {"id": "C301", "capacity": 100},
            {"id": "D102", "capacity": 150}
        ],
        "time_limit_seconds": 10
    }
    
    return jsonify(demo_data), 200

if __name__ == '__main__':
    # Run the Flask app (for development only)
    # For production, use Gunicorn or another WSGI server
    app.run(debug=True, host='0.0.0.0', port=5000)