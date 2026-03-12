import { useEffect } from 'react';
import PropTypes from 'prop-types';

const CustomNotification = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    // Mostrar la notificación después de un breve delay
    const showTimer = setTimeout(() => {
      const notification = document.querySelector('.custom-notification');
      if (notification) {
        notification.classList.add('show');
      }
    }, 50);

    // Auto-remover después del tiempo especificado
    if (duration > 0) {
      const hideTimer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }

    return () => clearTimeout(showTimer);
  }, [duration]);

  const handleClose = () => {
    const notification = document.querySelector('.custom-notification');
    if (notification) {
      notification.classList.remove('show');
      setTimeout(() => {
        onClose();
      }, 300);
    } else {
      onClose();
    }
  };

  const icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };

  return (
    <div className={`custom-notification notification-${type}`}>
      <div className="notification-content">
        <div className="notification-icon">
          <i className={`bi ${icons[type] || icons.info}`}></i>
        </div>
        <div className="notification-message">{message}</div>
        <button
          className="notification-close"
          onClick={handleClose}
          aria-label="Cerrar notificación"
        >
          <i className="bi bi-x"></i>
        </button>
      </div>
    </div>
  );
};

CustomNotification.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
  onClose: PropTypes.func.isRequired,
  duration: PropTypes.number
};

export default CustomNotification;
