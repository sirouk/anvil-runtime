import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * Anvil Material Design Theme
 * 
 * This theme matches the native Material Design theme used by Anvil,
 * ensuring visual consistency between Anvil apps and the NextJS bridge.
 */

// Anvil's default Material Design color palette
const anvilColors = {
    primary: {
        main: '#1976d2',      // Material Blue 700
        light: '#42a5f5',     // Material Blue 400  
        dark: '#1565c0',      // Material Blue 800
        contrastText: '#ffffff'
    },
    secondary: {
        main: '#dc004e',      // Material Pink A400
        light: '#ff5983',     // Material Pink A200
        dark: '#9a0036',      // Material Pink A700
        contrastText: '#ffffff'
    },
    error: {
        main: '#f44336',      // Material Red 500
        light: '#e57373',     // Material Red 300
        dark: '#d32f2f',      // Material Red 700
        contrastText: '#ffffff'
    },
    warning: {
        main: '#ff9800',      // Material Orange 500
        light: '#ffb74d',     // Material Orange 300
        dark: '#f57c00',      // Material Orange 700
        contrastText: '#000000'
    },
    info: {
        main: '#2196f3',      // Material Blue 500
        light: '#64b5f6',     // Material Blue 300
        dark: '#1976d2',      // Material Blue 700
        contrastText: '#ffffff'
    },
    success: {
        main: '#4caf50',      // Material Green 500
        light: '#81c784',     // Material Green 300
        dark: '#388e3c',      // Material Green 700
        contrastText: '#ffffff'
    },
    grey: {
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#eeeeee',
        300: '#e0e0e0',
        400: '#bdbdbd',
        500: '#9e9e9e',
        600: '#757575',
        700: '#616161',
        800: '#424242',
        900: '#212121',
    },
    background: {
        default: '#fafafa',   // Material Grey 50
        paper: '#ffffff'
    },
    text: {
        primary: 'rgba(0, 0, 0, 0.87)',
        secondary: 'rgba(0, 0, 0, 0.6)',
        disabled: 'rgba(0, 0, 0, 0.38)'
    }
};

// Anvil's Material Design typography scale
const anvilTypography = {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
        fontSize: '2.125rem',
        fontWeight: 300,
        lineHeight: 1.167,
        letterSpacing: '-0.01562em'
    },
    h2: {
        fontSize: '1.5rem',
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: '-0.00833em'
    },
    h3: {
        fontSize: '1.25rem',
        fontWeight: 400,
        lineHeight: 1.167,
        letterSpacing: '0em'
    },
    h4: {
        fontSize: '1.125rem',
        fontWeight: 400,
        lineHeight: 1.235,
        letterSpacing: '0.00735em'
    },
    h5: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.334,
        letterSpacing: '0em'
    },
    h6: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.6,
        letterSpacing: '0.0075em'
    },
    body1: {
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0.00938em'
    },
    body2: {
        fontSize: '0.875rem',
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: '0.01071em'
    },
    button: {
        fontSize: '0.875rem',
        fontWeight: 500,
        lineHeight: 1.75,
        letterSpacing: '0.02857em',
        textTransform: 'uppercase' as const
    },
    caption: {
        fontSize: '0.75rem',
        fontWeight: 400,
        lineHeight: 1.66,
        letterSpacing: '0.03333em'
    },
    overline: {
        fontSize: '0.75rem',
        fontWeight: 400,
        lineHeight: 2.66,
        letterSpacing: '0.08333em',
        textTransform: 'uppercase' as const
    }
};

// Anvil's Material Design spacing system (8px base unit)
const anvilSpacing = (factor: number) => `${8 * factor}px`;

// Material Design elevation shadows (matching Anvil)
const anvilShadows = [
    'none',
    '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
    '0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)',
    '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)',
    '0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12)',
    '0px 3px 5px -1px rgba(0,0,0,0.2),0px 5px 8px 0px rgba(0,0,0,0.14),0px 1px 14px 0px rgba(0,0,0,0.12)',
    '0px 3px 5px -1px rgba(0,0,0,0.2),0px 6px 10px 0px rgba(0,0,0,0.14),0px 1px 18px 0px rgba(0,0,0,0.12)',
    '0px 4px 5px -2px rgba(0,0,0,0.2),0px 7px 10px 1px rgba(0,0,0,0.14),0px 2px 16px 1px rgba(0,0,0,0.12)',
    '0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1px rgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)',
    '0px 5px 6px -3px rgba(0,0,0,0.2),0px 9px 12px 1px rgba(0,0,0,0.14),0px 3px 16px 2px rgba(0,0,0,0.12)',
    '0px 6px 6px -3px rgba(0,0,0,0.2),0px 10px 14px 1px rgba(0,0,0,0.14),0px 4px 18px 3px rgba(0,0,0,0.12)',
    '0px 6px 7px -4px rgba(0,0,0,0.2),0px 11px 15px 1px rgba(0,0,0,0.14),0px 4px 20px 3px rgba(0,0,0,0.12)',
    '0px 7px 8px -4px rgba(0,0,0,0.2),0px 12px 17px 2px rgba(0,0,0,0.14),0px 5px 22px 4px rgba(0,0,0,0.12)',
    '0px 7px 8px -4px rgba(0,0,0,0.2),0px 13px 19px 2px rgba(0,0,0,0.14),0px 5px 24px 4px rgba(0,0,0,0.12)',
    '0px 7px 9px -4px rgba(0,0,0,0.2),0px 14px 21px 2px rgba(0,0,0,0.14),0px 5px 26px 4px rgba(0,0,0,0.12)',
    '0px 8px 9px -5px rgba(0,0,0,0.2),0px 15px 22px 2px rgba(0,0,0,0.14),0px 6px 28px 5px rgba(0,0,0,0.12)',
    '0px 8px 10px -5px rgba(0,0,0,0.2),0px 16px 24px 2px rgba(0,0,0,0.14),0px 6px 30px 5px rgba(0,0,0,0.12)',
    '0px 8px 11px -5px rgba(0,0,0,0.2),0px 17px 26px 2px rgba(0,0,0,0.14),0px 6px 32px 5px rgba(0,0,0,0.12)',
    '0px 9px 11px -5px rgba(0,0,0,0.2),0px 18px 28px 2px rgba(0,0,0,0.14),0px 7px 34px 6px rgba(0,0,0,0.12)',
    '0px 9px 12px -6px rgba(0,0,0,0.2),0px 19px 29px 2px rgba(0,0,0,0.14),0px 7px 36px 6px rgba(0,0,0,0.12)',
    '0px 10px 13px -6px rgba(0,0,0,0.2),0px 20px 31px 3px rgba(0,0,0,0.14),0px 8px 38px 7px rgba(0,0,0,0.12)',
    '0px 10px 13px -6px rgba(0,0,0,0.2),0px 21px 33px 3px rgba(0,0,0,0.14),0px 8px 40px 7px rgba(0,0,0,0.12)',
    '0px 10px 14px -6px rgba(0,0,0,0.2),0px 22px 35px 3px rgba(0,0,0,0.14),0px 8px 42px 7px rgba(0,0,0,0.12)',
    '0px 11px 14px -7px rgba(0,0,0,0.2),0px 23px 36px 3px rgba(0,0,0,0.14),0px 9px 44px 8px rgba(0,0,0,0.12)',
    '0px 11px 15px -7px rgba(0,0,0,0.2),0px 24px 38px 3px rgba(0,0,0,0.14),0px 9px 46px 8px rgba(0,0,0,0.12)'
];

// Create the Material Design theme that matches Anvil
const anvilMaterialTheme: ThemeOptions = {
    palette: anvilColors,
    typography: anvilTypography,
    spacing: anvilSpacing,
    shadows: anvilShadows as any,
    shape: {
        borderRadius: 4  // Anvil's default border radius
    },
    components: {
        // TextField (TextBox) styling to match Anvil
        MuiTextField: {
            defaultProps: {
                variant: 'outlined',
                size: 'medium'
            },
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: 'rgba(0, 0, 0, 0.23)',
                        },
                        '&:hover fieldset': {
                            borderColor: 'rgba(0, 0, 0, 0.87)',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: anvilColors.primary.main,
                            borderWidth: '2px',
                        },
                        '&.Mui-error fieldset': {
                            borderColor: anvilColors.error.main,
                        }
                    }
                }
            }
        },
        // Button styling to match Anvil
        MuiButton: {
            defaultProps: {
                variant: 'contained',
                size: 'medium'
            },
            styleOverrides: {
                root: {
                    textTransform: 'none',  // Anvil doesn't force uppercase
                    borderRadius: 4,
                    fontWeight: 500,
                    boxShadow: anvilShadows[2],
                    '&:hover': {
                        boxShadow: anvilShadows[4]
                    }
                },
                contained: {
                    backgroundColor: anvilColors.primary.main,
                    color: anvilColors.primary.contrastText,
                    '&:hover': {
                        backgroundColor: anvilColors.primary.dark
                    }
                }
            }
        },
        // Select/DropDown styling to match Anvil
        MuiSelect: {
            defaultProps: {
                variant: 'outlined'
            }
        },
        // FormControl styling
        MuiFormControl: {
            defaultProps: {
                variant: 'outlined',
                size: 'medium'
            }
        },
        // Checkbox styling to match Anvil
        MuiCheckbox: {
            styleOverrides: {
                root: {
                    color: anvilColors.grey[600],
                    '&.Mui-checked': {
                        color: anvilColors.primary.main
                    }
                }
            }
        },
        // Radio button styling to match Anvil
        MuiRadio: {
            styleOverrides: {
                root: {
                    color: anvilColors.grey[600],
                    '&.Mui-checked': {
                        color: anvilColors.primary.main
                    }
                }
            }
        },
        // Paper/Card styling for containers
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: anvilColors.background.paper,
                    boxShadow: anvilShadows[1]
                }
            }
        }
    }
};

export const createAnvilTheme = () => createTheme(anvilMaterialTheme);

export default anvilMaterialTheme; 