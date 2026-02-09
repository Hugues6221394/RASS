import React from 'react';
import { Badge, IconButton, Tooltip } from '@mui/material';
import { ShoppingCart } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export const CartIcon: React.FC = () => {
    const { itemCount } = useCart();
    const navigate = useNavigate();

    return (
        <Tooltip title="Shopping Cart">
            <IconButton
                color="inherit"
                onClick={() => navigate('/cart')}
                aria-label={`${itemCount} items in cart`}
            >
                <Badge badgeContent={itemCount} color="error">
                    <ShoppingCart />
                </Badge>
            </IconButton>
        </Tooltip>
    );
};
