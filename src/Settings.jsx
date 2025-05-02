
import React, { useState } from 'react';
import { Container, Row, Col, Card, Image, Modal, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import styles from './MainContent.module.css';
import { Edit3 } from 'lucide-react';

export default function Settings() {

  const [user, setUser] = useState({
    name: 'Aditya Sharma',
    role: 'Profile Manager',
    email: 'aditya@example.com',
    profilePic: 'https://i.pravatar.cc/150?img=3',
  });

  const [showModal, setShowModal] = useState(false);
  const [editField, setEditField] = useState('');
  const [inputValue, setInputValue] = useState('');

  const handleEdit = (field) => {
    setEditField(field);
    setInputValue(user[field]);
    setShowModal(true);
  };

  const handleSave = () => {
    setUser({ ...user, [editField]: inputValue });
    setShowModal(false);
  };

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <Row className="justify-content-center mt-4">
        <Col md={7} lg={6}>
          <Card className={`${styles.profileCard} d-flex flex-column align-items-center text-center p-4`}>
            <div className="position-relative mb-4">
              <Image
                src={user.profilePic}
                roundedCircle
                className={styles.avatar}
              />
              <OverlayTrigger placement="top" overlay={<Tooltip>Edit Picture</Tooltip>}>
                <Edit3
                  className={styles.editIcon}
                  size={18}
                  onClick={() => handleEdit('profilePic')}
                />
              </OverlayTrigger>
            </div>
            <h4 className="fw-semibold mb-1 d-flex align-items-center justify-content-center gap-2">
              {user.name}
              <Edit3 className={styles.inlineEdit} size={16} onClick={() => handleEdit('name')} />
            </h4>
            <p className="text-muted mb-2">{user.role}</p>
            <p className="d-flex align-items-center justify-content-center gap-2">
              {user.email}
              <Edit3 className={styles.inlineEdit} size={16} onClick={() => handleEdit('email')} />
            </p>
          </Card>
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit {editField.charAt(0).toUpperCase() + editField.slice(1)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Control
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
                className="rounded-3 p-2"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-dark" onClick={handleSave}>Save</button>
        </Modal.Footer>
      </Modal>
    </Col>
  )
}
