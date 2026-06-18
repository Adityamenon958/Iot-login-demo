import React from 'react';
import { Form } from 'react-bootstrap';
import styles from './EnergyMeterSearch.module.css';

export default function EnergyMeterSearch({ value, onChange, placeholder = 'Search meter...' }) {
  return (
    <Form.Control
      type="search"
      size="sm"
      className={styles.search}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Search meters"
    />
  );
}
