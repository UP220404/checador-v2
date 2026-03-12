import { useEffect } from 'react';
import '../styles/Toast.css';

function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'bi-check-circle-fill';
      case 'error':
        return 'bi-x-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'info':
        return 'bi-info-circle-fill';
      default:
        return 'bi-check-circle-fill';
    }
  };

  return (
    <div className={`toast-notification toast-${type}`}>
      <div className="toast-icon">
        <i className={`bi ${getIcon()}`}></i>
      </div>
      <div className="toast-content">
        <p className="toast-message">{message}</p>
      </div>
      <button className="toast-close" onClick={onClose}>
        <i className="bi bi-x"></i>
      </button>
    </div>
  );
}

export default Toast;
