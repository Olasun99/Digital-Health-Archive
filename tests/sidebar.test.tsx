import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import App from '../src/App';

describe('App Shell Layout & Navigation', () => {
  it('renders the sidebar and expects the text "Dashboard"', () => {
    render(<App />);
    const dashboardElements = screen.getAllByText('Dashboard');
    expect(dashboardElements.length).toBeGreaterThan(0);
    expect(screen.getByTestId('nav-dashboard')).toBeDefined();
  });
});
