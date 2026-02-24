import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotification, createSuccessNotification } from '../NotificationContext';

// Test component
const TestComponent: React.FC = () => {
  const { notifications, addNotification, removeNotification, clearNotifications } = useNotification();
  
  return (
    <div>
      <button
        onClick={() => addNotification(createSuccessNotification('Test message', 'Test title'))}
        data-testid="add-notification"
      >
        Add Notification
      </button>
      <button
        onClick={() => {
          if (notifications.length > 0) {
            removeNotification(notifications[0].id);
          }
        }}
        data-testid="remove-notification"
      >
        Remove First
      </button>
      <button onClick={clearNotifications} data-testid="clear-all">
        Clear All
      </button>
      <div data-testid="notification-count">
        {notifications.length}
      </div>
      <div data-testid="notifications">
        {notifications.map(n => (
          <div key={n.id} data-testid={`notification-${n.id}`}>
            {n.title}: {n.message}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should add notification', async () => {
    const { getByTestId, queryByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    expect(getByTestId('notification-count').textContent).toBe('0');

    act(() => {
      getByTestId('add-notification').click();
    });

    await waitFor(() => {
      expect(getByTestId('notification-count').textContent).toBe('1');
    });

    expect(queryByTestId(/notification-/)).toBeTruthy();
  });

  it('should remove notification', async () => {
    const { getByTestId, queryByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add notification first
    act(() => {
      getByTestId('add-notification').click();
    });

    await waitFor(() => {
      expect(getByTestId('notification-count').textContent).toBe('1');
    });

    // Remove notification
    act(() => {
      getByTestId('remove-notification').click();
    });

    await waitFor(() => {
      expect(getByTestId('notification-count').textContent).toBe('0');
    });
  });

  it('should clear all notifications', async () => {
    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add multiple notifications
    act(() => {
      getByTestId('add-notification').click();
      getByTestId('add-notification').click();
    });

    await waitFor(() => {
      expect(getByTestId('notification-count').textContent).toBe('2');
    });

    // Clear all
    act(() => {
      getByTestId('clear-all').click();
    });

    await waitFor(() => {
      expect(getByTestId('notification-count').textContent).toBe('0');
    });
  });

  it('should respect max notifications limit', async () => {
    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add more notifications than the default max (5)
    for (let i = 0; i < 7; i++) {
      act(() => {
        getByTestId('add-notification').click();
      });
    }

    await waitFor(() => {
      expect(getByTestId('notification-count').textContent).toBe('5');
    });
  });

  it('should load settings from localStorage', () => {
    const settings = {
      maxNotifications: 3,
      position: 'bottom-left' as const,
      soundEnabled: false,
      vibrationEnabled: false,
    };

    localStorage.setItem('notificationSettings', JSON.stringify(settings));

    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    // Add more than the custom max
    for (let i = 0; i < 5; i++) {
      act(() => {
        getByTestId('add-notification').click();
      });
    }

    expect(getByTestId('notification-count').textContent).toBe('3');
  });

  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useNotification must be used within a NotificationProvider');

    consoleError.mockRestore();
  });
});
