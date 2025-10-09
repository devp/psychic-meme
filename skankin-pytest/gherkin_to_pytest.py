#!/usr/bin/env python3
"""
Convert Gherkin feature files to pytest test stubs.

Usage:
    python gherkin_to_pytest.py input.feature output_test.py
"""

import sys
import re
from pathlib import Path


def sanitize_test_name(scenario_name):
    """Convert scenario name to valid Python test function name."""
    # Remove special characters, replace spaces with underscores
    name = re.sub(r'[^\w\s-]', '', scenario_name.lower())
    name = re.sub(r'[-\s]+', '_', name)
    return f"test_{name}"


def parse_gherkin(content):
    """Parse Gherkin content into structured data."""
    lines = content.split('\n')
    feature = None
    scenarios = []
    current_scenario = None
    current_steps = []
    
    for line in lines:
        line = line.strip()
        
        if line.startswith('Feature:'):
            feature = line[8:].strip()
        elif line.startswith('Scenario:'):
            if current_scenario:
                scenarios.append({
                    'name': current_scenario,
                    'steps': current_steps
                })
            current_scenario = line[9:].strip()
            current_steps = []
        elif line.startswith(('Given ', 'When ', 'Then ', 'And ', 'But ')):
            current_steps.append(line)
    
    # Don't forget the last scenario
    if current_scenario:
        scenarios.append({
            'name': current_scenario,
            'steps': current_steps
        })
    
    return feature, scenarios


def generate_pytest(feature, scenarios):
    """Generate pytest code from parsed Gherkin."""
    output = []
    
    # Header
    output.append('"""')
    output.append(f'Tests for: {feature}')
    output.append('"""')
    output.append('import pytest')
    output.append('')
    output.append('')
    
    # Generate test functions
    for scenario in scenarios:
        test_name = sanitize_test_name(scenario['name'])
        
        output.append('@pytest.mark.skip(reason="TODO: Implement test")')
        output.append(f'def {test_name}():')
        output.append('    """')
        output.append(f'    Scenario: {scenario["name"]}')
        output.append('')
        
        # Add steps as docstring
        for step in scenario['steps']:
            output.append(f'    {step}')
        
        output.append('    """')
        output.append('    assert False, "TODO: Implement this test"')
        output.append('')
        output.append('')
    
    return '\n'.join(output)


def main():
    if len(sys.argv) != 3:
        print("Usage: python gherkin_to_pytest.py input.feature output_test.py")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    
    if not input_file.exists():
        print(f"Error: Input file '{input_file}' not found")
        sys.exit(1)
    
    # Read Gherkin file
    content = input_file.read_text()
    
    # Parse and generate
    feature, scenarios = parse_gherkin(content)
    pytest_code = generate_pytest(feature, scenarios)
    
    # Write output
    output_file.write_text(pytest_code)
    print(f"Generated {len(scenarios)} test stubs in {output_file}")


if __name__ == '__main__':
    main()
