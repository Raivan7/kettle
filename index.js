(function () {
    /*
        * Since we have an "electric kettle" and it can have different states(on, off, boil, stop), the behavior of the kettle should vary based on the current state
        ** it was decided to use a 'State' pattern to control kettle behavior in different states reliably.
        *
        * There is one nuance. Each time the user clicks the kettle button - we track if something is supposed to happen.
        * For example, it makes no sense for a kettle to work if it's in an 'off' state and the user clicks the 'boil' button.
        * That's why the 'isStateChanged' flag is used here.
        * Once we know that the 'logical' behavior happened (considering the current state of the kettle), we can safely execute 'callback'.
        * 'callback' is a client's code that interacts with UI once the state of the kettle actually changes.
    */
    class Kettle {
        constructor() {
            this.currentState = new KettleOff(this);
        }

        setState(state) {
            this.currentState = state;
        }

        log() {
            return this.currentState.log();
        }

        clickOn(callback = () => { }) {
            const isStateChanged = this.currentState.clickOn();

            if (isStateChanged) {
                callback();
            }

            return isStateChanged;
        }

        clickOff(callback = () => { }) {
            const isStateChanged = this.currentState.clickOff();

            if (isStateChanged) {
                callback();
            }
            return isStateChanged;
        }

        clickStop(callback = () => { }) {
            const isStateChanged = this.currentState.clickStop();

            if (isStateChanged) {
                callback();
            }
            return isStateChanged;
        }

        clickBoil(callback = () => { }) {
            const isStateChanged = this.currentState.clickBoil();

            if (isStateChanged) {
                callback();
            }
            return isStateChanged;
        }
    }

    class KettleState {
        constructor(kettle) {
            this.kettle = kettle;
        }
    }

    class KettleOn extends KettleState {
        log() {
            return KETTLE_STATES.ON
        }

        clickOn() {
            return false;
        }

        clickOff() {
            this.kettle.setState(new KettleOff(this.kettle));
            return true;
        }

        clickStop() {
            return false;
        }

        clickBoil() {
            this.kettle.setState(new KettleBoiling(this.kettle));
            return true;
        }
    }

    class KettleOff extends KettleState {
        log() {
            return KETTLE_STATES.OFF
        }

        clickOn() {
            this.kettle.setState(new KettleOn(this.kettle));
            return true;
        }

        clickOff() {
            return false;
        }

        clickStop() {
            return false;
        }

        clickBoil() {
            return false;
        }
    }

    class KettleBoiling extends KettleState {
        log() {
            return KETTLE_STATES.BOIL
        }

        clickOn() {
            return false;
        }

        clickOff() {
            this.kettle.setState(new KettleOff(this.kettle));
            return true;
        }

        clickStop() {
            this.kettle.setState(new KettleStopped(this.kettle));
            return true;
        }

        clickBoil() {
            return false;
        }
    }

    class KettleStopped extends KettleState {
        log() {
            return KETTLE_STATES.STOP
        }

        clickOn() {
            return false;
        }

        clickOff() {
            this.kettle.setState(new KettleOff(this.kettle));
            return true;
        }

        clickStop() {
            return false;
        }

        clickBoil() {
            this.kettle.setState(new KettleBoiling(this.kettle));
            return true;
        }
    }

    const kettle = new Kettle();

    // constants
    const BOILING_TIME = 10000;
    const SHOW_INTERVAL_TIME = 1000;
    const KETTLE_STATES = {
        ON: 'on',
        OFF: 'off',
        BOIL: 'boil',
        STOP: 'stop'
    };
    const CONTROLS_LIST = [
        KETTLE_STATES.ON,
        KETTLE_STATES.OFF,
        KETTLE_STATES.BOIL,
        KETTLE_STATES.STOP
    ];
    const MESSAGES = {
        [KETTLE_STATES.ON]: 'Kettle is on',
        [KETTLE_STATES.OFF]: 'Kettle is off',
        [KETTLE_STATES.BOIL]: 'Kettle is boiling',
        [KETTLE_STATES.STOP]: 'Kettle stopped'
    };

    /*
      * Since it's stated in the requirements, that we can't utilize 3-rd party libraries
      * Here is a simple implementation of notifications, inspired by 'react-hot-toast'
    */
    const NotificationContext = React.createContext(null);

    const Notification = ({ message }) => {
        return React.createElement('div', { className: `dialog` }, React.createElement('p', null, message));
    }

    const NotificationProvider = ({ children }) => {
        const [notifications, setNotifications] = React.useState([]);

        const addNotification = (message, id) => {
            setNotifications((state) => [{ message, id }, ...state]);
        };

        const removeNotification = (id) => {
            setNotifications((state) => state.filter((notification) => notification.id !== id));
        };

        return React.createElement(
            NotificationContext.Provider,
            { value: { addNotification, removeNotification } },
            children,
            React.createElement(
                'div',
                { className: 'notification-container' },
                notifications.map(({ message, id }) => React.createElement(Notification, { message, key: id }))
            )
        );
    }

    // Custom Hook to use notifications
    const useNotify = () => {
        let { addNotification, removeNotification } = React.useContext(NotificationContext);

        /*
            * useCallback is required here to keep the same reference, because "notify" is used as a dependency in deps array.
            * "addNotification" and "removeNotification" are not wrapped into useCallback intentionally, because memoization is expensive
            ** and in this case we will not gain a significant reduction of rerenders ()
        */
        const notify = React.useCallback((message) => {
            const id = Date.now();
            addNotification(message, id);

            const timer = setTimeout(() => {
                removeNotification(id);
                clearTimeout(timer);
            }, 3000);
        }, [addNotification, removeNotification]);

        return [notify];
    }

    /*
      * Controls is a component, that represents control buttons for changing kettle state
      *
      * React.memo is required here to optimize renders, because "Controls" is used in "Toolbar" component
      * And "Toolbar" component uses a lot of different states
    */
    const Controls = React.memo(({ activeControl, handleChangeControl }) => {
        const handleClick = (control) => () => {
            handleChangeControl(control);
        };

        return React.createElement(
            'div',
            { className: 'control-list' },
            CONTROLS_LIST.map(control => React.createElement(
                'button',
                {
                    className: `control-item ${activeControl === control ? 'active' : ''}`,
                    onClick: handleClick(control)
                },
                control
            ))
        );
    });

    /*
      * TemperatureDisplay is a component, that represents how the temperature of the kettle changes
      *
      * React.memo is required here to optimize renders, because "TemperatureDisplay" is used in "Toolbar" component
      * And "Toolbar" component uses a lot of different states
    */
    const TemperatureDisplay = React.memo(({ temperature, isTemperatureShown }) => {
        if (!isTemperatureShown) {
            return null;
        }

        return React.createElement('div', { className: 'display-temperature' }, `${temperature} C`);
    });

    /*
      * WaterDipslay is a component, that represents how the water amount of the kettle changes
      *
      * React.memo is required here to optimize renders, because "WaterDipslay" is used in "Toolbar" component
      * And "Toolbar" component uses a lot of different states
    */
    const WaterDipslay = React.memo(({ isWaterDisabled, waterAmount, handleChangeWaterAmount }) => {
        const handleChange = (event) => {
            handleChangeWaterAmount(event.target.value);
        };

        return React.createElement(
            'div',
            { className: 'water-amount' },
            `water: ${waterAmount / 10}`,
            React.createElement('input', { type: 'range', min: 0, max: 10, onChange: handleChange, value: waterAmount, disabled: isWaterDisabled }));
    });

    const useKettle = () => {
        const [temperature, setTemperature] = React.useState(0);
        const [isTemperatureShown, setIsTemperatureShown] = React.useState(false);
        const [activeControl, setActiveControl] = React.useState(KETTLE_STATES.OFF);
        const [isWaterDisabled, setIsWaterDisabled] = React.useState(false);
        const [waterAmount, setWaterAmout] = React.useState(0);

        const [notify] = useNotify();

        // Using refs to keep variable values between rerenders
        const intervalRef = React.useRef(null);
        const timerRef = React.useRef(null);
        const timeLeftRef = React.useRef(BOILING_TIME);

        const clearTimers = (timerId, intervalId) => {
            clearInterval(intervalId);
            clearTimeout(timerId);
        }

        // useCallback is required here for React.memo(WaterDisplay) to work
        const handleChangeWaterAmount = React.useCallback((newWaterAmount) => {
            setWaterAmout(newWaterAmount);
        }, []);

        // useCallback is required here because "setKettleOff" is a dependency for deps array in "handleChangeControl"
        const setKettleOff = React.useCallback((timerId, intervalId) => {
            // setting default states
            setIsTemperatureShown(false);
            setIsWaterDisabled(false);
            setTemperature(0);

            // clearing all timers
            clearTimers(timerId, intervalId);
            intervalRef.current = null;
            timerRef.current = null;
            timeLeftRef.current = BOILING_TIME;

            // setting actual state of the kettle to 'off'
            kettle.clickOff();
        }, []);

        /*
            * 'handleChangeControl' does:
            * - setActiveControl (sets currently active button)
            * - calls kettle methods, which handle the state changes
            * - send client's callbacks into kettle methods to execute, when the state actually changes
            * - calls 'notify' to show notification when state actually changes
            * 
            * useCallback is required here for React.memo(Controls) to work
        */
        const handleChangeControl = React.useCallback((currentControl) => {
            const setControlButton = (currentControl) => {
                setActiveControl(currentControl);
                notify(MESSAGES[currentControl]);
            }

            switch (currentControl) {
                case KETTLE_STATES.ON:
                    kettle.clickOn(() => {
                        setIsTemperatureShown(true);
                        setControlButton(KETTLE_STATES.ON);
                    });
                    break;

                case KETTLE_STATES.OFF:
                    kettle.clickOff(() => {
                        setKettleOff(timerRef.current, intervalRef.current);
                        setControlButton(KETTLE_STATES.OFF);
                    });
                    break;

                case KETTLE_STATES.BOIL:
                    kettle.clickBoil(() => {
                        setIsWaterDisabled(true);
                        setControlButton(KETTLE_STATES.BOIL);

                        intervalRef.current = setInterval(() => {
                            setTemperature((currentTemperature) => currentTemperature + 10);

                            timeLeftRef.current -= 1000;
                        }, SHOW_INTERVAL_TIME);

                        timerRef.current = setTimeout(() => {
                            setKettleOff(timerRef.current, intervalRef.current);
                            setControlButton(KETTLE_STATES.OFF);
                        }, timeLeftRef.current);
                    });
                    break;

                case KETTLE_STATES.STOP:
                    kettle.clickStop(() => {
                        clearTimers(timerRef.current, intervalRef.current);
                        setControlButton(KETTLE_STATES.STOP);
                    });
                    break;

                default:
                    break;
            }
        }, [notify, setKettleOff]);

        return { activeControl, isTemperatureShown, isWaterDisabled, temperature, handleChangeControl, waterAmount, handleChangeWaterAmount }
    }

    /*
      * Main wrapper for the kettle app
    */
    const Toolbar = () => {
        const { activeControl, temperature, isTemperatureShown, isWaterDisabled, handleChangeControl, waterAmount, handleChangeWaterAmount } = useKettle();

        return React.createElement(
            'div',
            null,
            React.createElement(Controls, { activeControl, handleChangeControl }),
            React.createElement(WaterDipslay, { isWaterDisabled, waterAmount, handleChangeWaterAmount }),
            React.createElement(TemperatureDisplay, { temperature, isTemperatureShown })
        )
    }

    const App = () => {
        return React.createElement(
            'div',
            {
                className: 'container'
            },
            React.createElement(NotificationProvider, null,
                React.createElement(
                    Toolbar,
                    null
                )
            ),
            React.createElement('img', { className: 'kettle-img', alt: 'Kettle image', src: './kettle.webp' })
        )
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
        React.createElement(App, null)
    );
})(React, ReactDOM)


