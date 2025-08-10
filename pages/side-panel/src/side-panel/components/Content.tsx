import React from 'react';
import { makeStyles } from '@fluentui/react-components';
import { Main } from '../pages/Main';
import { BrowserUse } from '../pages/BrowserUse';
import { useTabNavigationContext } from '../context/TabNavigationContext';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    padding: '10px',
    boxSizing: 'border-box',
    flex: '1 0 auto',
    position: 'relative',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
});

export const Content: React.FC = () => {
  const styles = useStyles();
  const { currentPage } = useTabNavigationContext();

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'main':
        return <Main />;
      case 'browseruse':
        return <BrowserUse />;
      default:
        return <BrowserUse />; // Default to BrowserUse
    }
  };

  return <div className={styles.root}>{renderCurrentPage()}</div>;
};
